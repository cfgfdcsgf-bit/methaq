import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, ChevronLeft, Search, X } from "lucide-react";
import { Link, useSearch } from "wouter";
import QuranPassages from "@/components/QuranPassages";
import { SEERAH_TIMELINE, SEERAH_TOPICS } from "@/data/seerah";
import "@/seerah.css";

const count = new Intl.NumberFormat("ar-EG");
const ordered = SEERAH_TIMELINE.flatMap(group => group.chapters.map(chapter => ({ ...chapter, group: group.title, branch: "timeline" })));
const thematic = SEERAH_TOPICS.flatMap(group => group.chapters.map(chapter => ({ ...chapter, group: group.title, branch: "topics" })));
const allChapters = [...ordered, ...thematic];
const chapterUrl = (id: string) => `/seerah?chapter=${id}`;
const normalize = (text: string) => text.replace(/[\p{M}ـ]/gu, "").replace(/[أإآٱ]/gu, "ا").replace(/ى/gu, "ي").trim();

function SeerahReader({ entry }: { entry: (typeof allChapters)[number] }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const collection = entry.branch === "timeline" ? ordered : thematic;
  const index = collection.findIndex(chapter => chapter.id === entry.id);
  const previous = collection[index - 1];
  const next = collection[index + 1];

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start" });
  }, [entry.id]);

  return <article className="seerah-reader">
    <Link className="seerah-back" href="/seerah"><ArrowRight size={17} aria-hidden="true" /> فهرس السيرة</Link>
    <header>
      <div className="seerah-reader-meta"><span>{entry.group}</span><span>{entry.period}</span></div>
      <h1 ref={heading} tabIndex={-1}>{entry.title}</h1>
      <p className="seerah-standfirst">{entry.summary}</p>
    </header>
    <div className="seerah-prose">{entry.body.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
    {entry.note && <p className="seerah-note">{entry.note}</p>}
    {entry.verses && <section className="seerah-evidence" aria-label="الآيات المرتبطة">
      <h2>من القرآن الكريم</h2>
      <QuranPassages key={entry.id} references={entry.verses} compact linkToQuran={false} />
    </section>}
    <section className="seerah-sources" aria-labelledby="seerah-source-title">
      <h2 id="seerah-source-title">المراجع</h2>
      <ul>{entry.sources.map(source => <li key={source}>{source}</li>)}</ul>
    </section>
    <Link className="detail-btn" href={`/rafiq?seerah=${encodeURIComponent(entry.title)}`}>اسأل رفيق عن هذا الفصل</Link>
    <nav className="seerah-chapter-nav" aria-label="التنقل بين فصول السيرة">
      {previous && <Link href={chapterUrl(previous.id)}><ArrowRight size={17} aria-hidden="true" /><span><small>السابق</small>{previous.title}</span></Link>}
      {next && <Link href={chapterUrl(next.id)}><span><small>التالي</small>{next.title}</span><ArrowLeft size={17} aria-hidden="true" /></Link>}
    </nav>
  </article>;
}

export default function SeerahPage() {
  const [search, setSearch] = useState("");
  const searchBox = useRef<HTMLInputElement>(null);
  const searchParams = new URLSearchParams(useSearch());
  const chapter = searchParams.get("chapter");
  const selected = chapter && allChapters.find(entry => entry.id === chapter);
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  const results = terms.length ? allChapters.filter(entry => {
    const text = normalize([entry.title, entry.period, entry.summary, ...entry.body].join(" "));
    return terms.every(term => text.includes(term));
  }) : [];

  return <main className="section-wrap section-page seerah-page" dir="rtl">
    <div className="page-crumb"><Link href="/">الرئيسية</Link><ChevronLeft size={14} aria-hidden="true" />
      <Link href="/explore">كل الأقسام</Link><ChevronLeft size={14} aria-hidden="true" />
      {selected ? <Link href="/seerah">السيرة النبوية</Link> : "السيرة النبوية"}
    </div>
    {selected ? <SeerahReader entry={selected} /> : <>
      <header className="seerah-hero">
        <h1>السيرة النبوية</h1>
        <div className="seerah-wordmark" role="img" aria-label="محمد صلى الله عليه وسلم">
          <div className="seerah-wordmark-name" aria-hidden="true">مُحَمَّد</div>
          <div className="seerah-wordmark-salutation" aria-hidden="true">صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ</div>
        </div>
        <p>من نشأته في مكة إلى ختام رسالته في المدينة. اقرأ محطات حياته، وتعرّف إلى أهل بيته وشمائله وهديه في العبادة والمعاملة.</p>
        <div className="seerah-hero-actions">
          <a href="#seerah-timeline">اقرأ السيرة بالترتيب <ArrowDown size={17} aria-hidden="true" /></a>
          <a href="#seerah-topics">تصفّح الأبواب <BookOpen size={17} aria-hidden="true" /></a>
        </div>
      </header>
      <div className="seerah-search">
        <label htmlFor="seerah-search"><Search size={20} aria-hidden="true" /></label>
        <input id="seerah-search" type="search" ref={searchBox} value={search} maxLength={120} onChange={event => setSearch(event.target.value)}
          aria-label="ابحث في السيرة النبوية" placeholder="ابحث عن حدث أو شخص أو موضوع…" />
        {search && <button type="button" aria-label="مسح البحث" onClick={() => { setSearch(""); searchBox.current?.focus(); }}><X size={18} /></button>}
      </div>
      {terms.length ? <section className="seerah-section" aria-labelledby="seerah-results">
        <div className="seerah-section-heading">
          <h2 id="seerah-results">نتائج البحث</h2>
          <output aria-live="polite">{count.format(results.length)} نتيجة</output>
        </div>
        {results.length ? <ul className="seerah-results">
          {results.map(entry => <li key={entry.id}>
            <Link href={chapterUrl(entry.id)}>
              <small>{entry.group} · {entry.period}</small><strong>{entry.title}</strong><span>{entry.summary}</span>
            </Link>
          </li>)}
        </ul> : <p className="seerah-empty">تعذّر العثور على فصل بهذا البحث. جرّب كلمة أقصر مثل «الهجرة» أو «خديجة».</p>}
      </section> : <>
        <section className="seerah-section" id="seerah-timeline" aria-labelledby="seerah-timeline-title">
          <div className="seerah-section-heading"><div><h2 id="seerah-timeline-title">خط السيرة الزمني</h2><p>ابدأ من مكة أو اختر المرحلة التي تريد قراءتها.</p></div><span>{count.format(ordered.length)} فصلًا</span></div>
          <ol className="seerah-timeline">
            {SEERAH_TIMELINE.map((group, index) => <li key={group.id} id={group.id}>
              <span className="seerah-timeline-number" aria-hidden="true">{count.format(index + 1)}</span>
              <div className="seerah-timeline-panel">
                <h3>{group.title}</h3><p>{group.description}</p>
                <ul className="seerah-chapter-list">
                  {group.chapters.map(entry => <li key={entry.id}><Link href={chapterUrl(entry.id)}>
                    <span><strong>{entry.title}</strong><small>{entry.period}</small></span><ArrowLeft size={16} aria-hidden="true" />
                  </Link></li>)}
                </ul>
              </div>
            </li>)}
          </ol>
        </section>
        <section className="seerah-section" id="seerah-topics" aria-labelledby="seerah-topics-title">
          <div className="seerah-section-heading"><div><h2 id="seerah-topics-title">من شمائله وهديه ﷺ</h2><p>اقرأ السيرة من خلال حياته اليومية وعلاقته بأهله والناس.</p></div><span>{count.format(thematic.length)} فصلًا</span></div>
          <div className="seerah-topic-grid">{SEERAH_TOPICS.map(group => <section className="seerah-timeline-panel" key={group.id}>
            <h3>{group.title}</h3><p>{group.description}</p>
            <ul className="seerah-chapter-list">
              {group.chapters.map(entry => <li key={entry.id}><Link href={chapterUrl(entry.id)}>
                <strong>{entry.title}</strong><ArrowLeft size={16} aria-hidden="true" />
              </Link></li>)}
            </ul>
          </section>)}</div>
        </section>
      </>}
    </>}
  </main>;
}
