"""Render the supplied Madinah Mushaf PDF into page images using Poppler and Pillow."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import file_digest
from io import BytesIO
from pathlib import Path
from subprocess import run

from PIL import Image


SOURCE_SHA256 = "be0091b2fac87706c240f27398e00e7848daebbd69f7ec437859f66fca15d562"
PAGE_COUNT = 604
PDF_PAGE_OFFSET = 3
OUTPUT = Path(__file__).resolve().parents[1] / "client/public/data/quran/print-be0091b2"


def render_page(source: Path, page: int) -> None:
    pdf_page = str(page + PDF_PAGE_OFFSET)
    rendered = run(
        ["pdftoppm", "-f", pdf_page, "-l", pdf_page, "-singlefile",
         "-scale-to", "1600", "-png", str(source)],
        check=True, capture_output=True,
    )
    output = OUTPUT / f"{page:03}.webp"
    temporary = output.with_suffix(".tmp")
    with Image.open(BytesIO(rendered.stdout)) as raster:
        raster.save(temporary, "WEBP", quality=92, method=4)
    temporary.replace(output)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="The original standard1-quran.pdf")
    source = parser.parse_args().source.resolve(strict=True)
    with source.open("rb") as pdf:
        if file_digest(pdf, "sha256").hexdigest() != SOURCE_SHA256:
            parser.error("This PDF does not match the verified print edition.")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=6) as workers:
        pages = workers.map(lambda page: render_page(source, page), range(1, PAGE_COUNT + 1))
        for completed, _ in enumerate(pages, 1):
            if completed % 50 == 0 or completed == PAGE_COUNT:
                print(f"{completed}/{PAGE_COUNT} pages rendered", flush=True)


if __name__ == "__main__":
    main()
