import { Link } from "wouter";

export function MithaqMark() {
  return <span className="brand-mark" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="20" height="20" focusable="false">
      <polygon points="12,1 14.6,6.6 20.5,3.5 17.4,9.4 23,12 17.4,14.6 20.5,20.5 14.6,17.4 12,23 9.4,17.4 3.5,20.5 6.6,14.6 1,12 6.6,9.4 3.5,3.5 9.4,6.6" fill="currentColor" />
    </svg>
  </span>;
}

export default function MithaqBrand({ onNavigate }: { onNavigate?: () => void } = {}) {
  return <Link href="/" onClick={onNavigate} className="brand mithaq-brand" dir="rtl">
    <MithaqMark />
    <span><b>مِيثَاق</b><small>رفقةٌ على هدي الوحي</small></span>
  </Link>;
}
