import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import { Link } from "wouter";
import QuranPassages from "@/components/QuranPassages";
import { ALLAH, DIVINE_NAMES, normalizeNameSearch, type DivineName } from "@/data/divine-names";
import "@/divine-names.css";

const arabicNumber = new Intl.NumberFormat("ar-EG");
const sourceFilters = [
  { key: "all", label: "الكل" },
  { key: "quran", label: "دليل من القرآن" },
  { key: "hadith", label: "دليل من السنة" },
] as const;

function NameReader({ name, index, onMove, onClose }: {
  name: DivineName; index: number; onMove: (index: number) => void; onClose: () => void;
}) {
  const reader = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (reader.current && !reader.current.open) reader.current.showModal();
  }, []);

  useEffect(() => {
    title.current?.focus();
    reader.current?.scrollTo(0, 0);
  }, [index]);

  return <dialog ref={reader} className="names-reader" aria-labelledby="names-reader-title" onClose={onClose} onClick={event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  }}>
    <div className="names-reader-content">
      <div className="names-reader-top">
        <span>{arabicNumber.format(index + 2)} من {arabicNumber.format(DIVINE_NAMES.length + 1)}</span>
        <button type="button" className="icon-btn" aria-label="إغلاق شرح الاسم" onClick={() => reader.current?.close()}><X size={22} /></button>
      </div>
      <h2 id="names-reader-title" ref={title} tabIndex={-1}>{name.name}</h2>
      <p className="names-reader-meaning">{name.meaning}</p>
      {name.note && <p className="names-reader-note">{name.note}</p>}
      <h3>دليل الاسم</h3>
      {name.evidence.kind === "quran"
        ? <QuranPassages key={name.name} references={[{ title: "من القرآن الكريم", surah: name.evidence.surah, ayah: name.evidence.ayah }]} compact linkToQuran={false} />
        : <div className="names-hadith-reference">
          <blockquote>«{name.evidence.excerpt}»</blockquote>
          <p>{name.evidence.reference}</p>
        </div>}
      <nav className="names-reader-nav" aria-label="التنقل بين الأسماء">
        <button type="button" disabled={index < 0} onClick={() => onMove(index - 1)}><ArrowRight size={17} /> السابق</button>
        <button type="button" disabled={index === DIVINE_NAMES.length - 1} onClick={() => onMove(index + 1)}>التالي <ArrowLeft size={17} /></button>
      </nav>
    </div>
  </dialog>;
}

export default function DivineNamesPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof sourceFilters)[number]["key"]>("all");
  const [open, setOpen] = useState<number | null>(null);
  const normalized = normalizeNameSearch(query);
  const items = normalized === "الله"
    ? (filter === "hadith" ? [] : [{ name: ALLAH, index: -1 }])
    : DIVINE_NAMES.map((name, index) => ({ name, index })).filter(({ name }) =>
      (filter === "all" || name.evidence.kind === filter) &&
      (!normalized || normalizeNameSearch(name.name).includes(normalized) || normalizeNameSearch(name.meaning).includes(normalized))
    );

  return <main className="section-wrap section-page names-page" dir="rtl">
    <div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} /><Link href="/explore">كل الأقسام</Link><ArrowLeft size={14} />أسماء الله الحسنى</div>
    <header className="names-hero">
      <h1>أسماء الله الحسنى</h1>
      <div className="names-hero-title">{ALLAH.name}</div>
      <p>{ALLAH.meaning}</p>
      <div className="names-hero-actions">
        <a className="names-primary" href="#names-index">تصفّح الأسماء <ArrowDown size={16} aria-hidden="true" /></a>
        <button type="button" onClick={() => setOpen(-1)}>معنى الاسم ودليله <ArrowLeft size={16} aria-hidden="true" /></button>
      </div>
    </header>

    <section id="names-index" className="names-index" aria-labelledby="names-heading">
      <div className="names-heading">
        <div><h2 id="names-heading">فهرس الأسماء</h2><p>{arabicNumber.format(DIVINE_NAMES.length + 1)} اسمًا إجمالًا، منها اسم «الله» في المقدّمة وتحته {arabicNumber.format(DIVINE_NAMES.length)} اسمًا.</p></div>
        <output aria-live="polite">{(normalized || filter !== "all") && `${arabicNumber.format(items.length)} نتيجة`}</output>
      </div>
      <div className="names-controls">
        <label className="names-search">
          <Search size={19} aria-hidden="true" />
          <input type="search" aria-label="ابحث عن اسم أو معنى" placeholder="ابحث عن اسم أو معنى…" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <div className="names-filters" role="group" aria-label="مصدر الدليل">
          {sourceFilters.map(({ key, label }) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
        </div>
      </div>
      {items.length ? <ol className="names-grid">
        {items.map(({ name, index }) => <li key={name.name}>
          <button className="names-card" type="button" onClick={() => setOpen(index)} aria-label={`اقرأ عن اسم ${name.name}`}>
            <span className="names-card-order">{arabicNumber.format(index + 2)}</span>
            <span className="names-card-name">{name.name}</span>
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
        </li>)}
      </ol> : <div className="names-empty">
        <p>لا توجد أسماء تطابق البحث الحالي.</p>
        <button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>عرض جميع الأسماء</button>
      </div>}
    </section>
    {open !== null && <NameReader name={open < 0 ? ALLAH : DIVINE_NAMES[open]} index={open} onMove={setOpen} onClose={() => setOpen(null)} />}
  </main>;
}
