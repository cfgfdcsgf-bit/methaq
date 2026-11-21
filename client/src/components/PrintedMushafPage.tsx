import { useState } from "react";

export const PRINT_PAGE_ROOT = "/data/quran/print-be0091b2";
export type PrintVerseRegion = [number, [number, number, number, number][]];

type Props = {
  page: number;
  regions: PrintVerseRegion[];
  selectedId?: number;
  playingId?: number;
  verseLabel: (id: number) => string | undefined;
  onSelect: (id: number, button: HTMLButtonElement, line: Element | null) => void;
};

export default function PrintedMushafPage({ page, regions, selectedId, playingId, verseLabel, onSelect }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const formattedPage = page.toLocaleString("ar-EG");
  const pathname = `${PRINT_PAGE_ROOT}/${String(page).padStart(3, "0")}.webp`;
  if (failed) {
    return <div className="quran-reader-message is-error" role="alert">
      تعذّر تحميل صورة الصفحة {formattedPage}.
      <button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>أعد المحاولة</button>
    </div>;
  }

  return <div className="mushaf-facsimile-leaf">
    <img className="mushaf-facsimile-page" src={attempt ? `${pathname}?retry=${attempt}` : pathname}
      alt={`الصفحة ${formattedPage} من طبعة مصحف المدينة النبوية`}
      width={1120} height={1600} decoding="async" draggable={false} onLoad={() => setLoaded(true)}
      onError={() => { setLoaded(false); setFailed(true); }} />
    {loaded && <div className="mushaf-print-regions">
      {regions.map(([id, boxes]) => {
        const label = verseLabel(id);
        if (!label) return null;
        const left = Math.min(...boxes.map(box => box[0]));
        const top = Math.min(...boxes.map(box => box[1]));
        const width = Math.max(...boxes.map(box => box[2])) - left;
        const height = Math.max(...boxes.map(box => box[3])) - top;
        return <button key={id} type="button" className="mushaf-print-ayah"
          aria-label={label} aria-pressed={id === selectedId} data-playing={id === playingId || undefined}
          style={{ left: `${left / 100}%`, top: `${top / 100}%`, width: `${width / 100}%`, height: `${height / 100}%` }}
          onClick={event => onSelect(id, event.currentTarget, event.target === event.currentTarget
            ? event.currentTarget.firstElementChild : event.target as Element)}>
          {boxes.map(([x1, y1, x2, y2], index) => <span key={index} aria-hidden="true"
            style={{ left: `${100 * (x1 - left) / width}%`, top: `${100 * (y1 - top) / height}%`,
              width: `${100 * (x2 - x1) / width}%`, height: `${100 * (y2 - y1) / height}%` }} />)}
        </button>;
      })}
    </div>}
  </div>;
}
