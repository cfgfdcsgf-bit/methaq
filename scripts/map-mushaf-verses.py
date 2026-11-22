"""Map verse hit regions to the exact images imported from standard1-quran.pdf."""

from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from csv import DictReader
from pathlib import Path
import json

import cv2
import numpy as np
from PIL import Image


QURAN_DATA = Path(__file__).resolve().parents[1] / "client/public/data/quran"
EDITION = QURAN_DATA / "print-be0091b2"
TOTAL_PAGES = 604

# The opening spreads have circular layouts. Coordinates are read from the
# unscaled 1020 × 1600 render, in verse order, with one box per printed line.
OPENING_BOXES = (
    (
        [(285, 601, 544, 655)],
        [(238, 660, 592, 714)],
        [(423, 714, 625, 771)],
        [(195, 714, 423, 771)],
        [(274, 772, 636, 829)],
        [(388, 830, 623, 888), (191, 772, 274, 829)],
        [(195, 830, 388, 888), (240, 889, 580, 947), (307, 948, 514, 1003)],
    ),
    (
        [(709, 660, 786, 714)],
        [(427, 660, 709, 714), (710, 714, 837, 772)],
        [(394, 714, 710, 772), (597, 772, 842, 828)],
        [(388, 772, 597, 828), (389, 828, 834, 888)],
        [(427, 889, 782, 947), (503, 948, 714, 1003)],
    ),
)


def read_page(page):
    with Image.open(EDITION / f"{page:03}.webp") as image:
        return np.array(image.convert("RGB"))


def darkness(image):
    return (255 - image.mean(axis=2)).astype(np.float32)


def marker_template(page, x, y, width, height):
    template = darkness(read_page(page)[y:y + height, x:x + width])
    mask = np.ones((height, width), np.uint8)
    # Ignore the differing digits inside the otherwise identical ornament.
    mask[int(.29 * height):int(.75 * height), int(.15 * width):int(.86 * width)] = 0
    return template, mask


def find_markers(image, template, mask, count, page):
    height, width = template.shape
    y0, x0 = 185, 80
    scores = cv2.matchTemplate(image[y0:1435, x0:-80], template, cv2.TM_CCOEFF_NORMED, mask=mask)
    scores[~np.isfinite(scores)] = -1
    matches = []
    for _ in range(count + 1):
        _, score, _, (x, y) = cv2.minMaxLoc(scores)
        if score < .54:
            break
        matches.append((x + x0 + width // 2, y + y0 + height // 2, score))
        scores[max(0, y - height // 2):y + height // 2 + 1,
               max(0, x - width // 2):x + width // 2 + 1] = -1
    if len(matches) < count or (len(matches) > count and matches[-1][2] >= .60):
        raise ValueError(f"Page {page}: ambiguous count of verse end markers")
    return matches[:count]


def frame_edges(green, tall):
    # The scans have three gutter offsets. Locate the side rails together, so
    # marginal section markers and green surah banners cannot become a rail.
    vertical = green[340:1240].mean(axis=0)
    candidates = [(116, 797), (171, 851), (226, 906)] if tall else [(127, 875), (187, 934), (245, 994)]
    return max(candidates, key=lambda pair:
               vertical[pair[0] - 41:pair[0] - 8].mean()
               + vertical[pair[1] + 8:pair[1] + 41].mean())


def map_page(page, verses, templates):
    if page <= 2:
        return 1020, {verse_id: boxes for (verse_id, _), boxes in zip(verses, OPENING_BOXES[page - 1], strict=True)}

    rgb = read_page(page)
    width = rgb.shape[1]
    tall = width == 1020
    if rgb.shape[:2] not in ((1600, 1020), (1600, 1119)):
        raise ValueError(f"Page {page}: unexpected raster size")
    image = darkness(rgb)
    marks = find_markers(image, *templates[tall], len(verses), page)
    nominal, step = (302, 71.6) if tall else (251, 78.7)
    phase = np.median([((y - nominal + step / 2) % step) - step / 2 for _, y, _ in marks])
    centers = np.round(nominal + phase + step * np.arange(15)).astype(int)
    end_markers = defaultdict(list)
    for x, y, _ in marks:
        line = int(np.argmin(abs(centers - y)))
        if abs(centers[line] - y) > 25:
            raise ValueError(f"Page {page}: marker between lines at {x}, {y}")
        end_markers[line].append(x)

    red, green, blue = rgb.transpose(2, 0, 1).astype(np.int16)
    ornament = (green - red > 15) & (green - blue > 10)
    left, right = frame_edges(ornament, tall)
    horizontal = ornament[:, left + 8:right - 8].mean(axis=1)
    regions = defaultdict(list)
    current = 0
    skip_basmala = False
    for line, y in enumerate(centers):
        if current == len(verses):
            break
        markers = sorted(end_markers[line], reverse=True)
        if not markers and np.sum(horizontal[y - 27:y + 28] > .48) > 8:
            skip_basmala = verses[current][1] != 9
            continue
        if skip_basmala:
            skip_basmala = False
            if not markers:
                continue

        top, bottom = int(y - step * .47), int(y + step * .46)
        ink = (image[top + 4:bottom - 4, left + 7:right - 7] > 105).sum(axis=0)
        columns = np.flatnonzero(ink > 1) + left + 7
        if not len(columns):
            continue
        start = int(columns[-1]) + 4
        floor = int(columns[0]) - 4
        for x in markers:
            split = x - (21 if tall else 23)
            if split >= start or x < left or x > right or current >= len(verses):
                raise ValueError(f"Page {page}: invalid verse boundary on line {line + 1}")
            regions[verses[current][0]].append((split, top, start, bottom))
            current += 1
            start = split
        if current < len(verses) and start - floor > 14 and (not markers or np.count_nonzero(columns < start - 3) >= 6):
            regions[verses[current][0]].append((floor, top, start, bottom))
    if current != len(verses) or set(regions) != {verse_id for verse_id, _ in verses}:
        raise ValueError(f"Page {page}: verse regions do not cover the source verse sequence")
    return width, regions


def main():
    cv2.setNumThreads(1)
    verses = defaultdict(list)
    with (QURAN_DATA / "quran-hafs.tsv").open(encoding="utf-8", newline="") as tsv:
        for row in DictReader(tsv, delimiter="\t"):
            verses[int(row["page"])].append((int(row["id"]), int(row["sura_no"])))
    templates = {True: marker_template(3, 186, 495, 42, 49),
                 False: marker_template(604, 210, 779, 47, 53)}

    def normalized(page):
        width, regions = map_page(page, verses[page], templates)
        return [[verse, [[round(x1 * 10000 / width), round(y1 * 10000 / 1600),
                          round(x2 * 10000 / width), round(y2 * 10000 / 1600)]
                         for x1, y1, x2, y2 in sorted(boxes, key=lambda box: (box[1], -box[0]))]]
                for verse, boxes in sorted(regions.items())]

    with ThreadPoolExecutor(max_workers=6) as workers:
        all_pages = list(workers.map(normalized, range(1, TOTAL_PAGES + 1)))
    if sum(map(len, all_pages)) != 6236:
        raise ValueError("Verse regions must cover all 6236 verse identifiers")
    (EDITION / "ayah-regions.json").write_text(json.dumps(all_pages, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
