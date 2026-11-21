import type { CSSProperties } from "react";
import { BookOpen, Check } from "lucide-react";
import { arNumber, MUSHAF_PAGES } from "@/lib/khatma";

export default function KhatmaMeter({ pages }: { pages: number }) {
  const percent = Math.floor((pages / MUSHAF_PAGES) * 100);
  return <div className="khatma-meter" role="progressbar" aria-label="تقدّم الختمة" aria-valuemin={0}
    aria-valuemax={MUSHAF_PAGES} aria-valuenow={pages}
    aria-valuetext={`${arNumber(pages)} من ${arNumber(MUSHAF_PAGES)} صفحة`}
    style={{ "--khatma-percent": percent + "%" } as CSSProperties}>
    <span className="khatma-meter-face" aria-hidden="true">
      {pages === MUSHAF_PAGES ? <Check size={20} /> : <BookOpen size={20} />}
      <b>{arNumber(percent)}٪</b>
    </span>
  </div>;
}
