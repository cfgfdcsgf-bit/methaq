import { useEffect, useRef, useState } from "react";
import { ArrowUpLeft, BookOpen, GraduationCap, Headphones, Play, Search, X } from "lucide-react";
import { Link } from "wouter";
import { courses, learningTopics, podcasts, youtubeWatchUrl, type LearningTopic } from "@/data/learning-media";

const pageSize = 12;
const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}|ـ/gu, "").replace(/ى/g, "ي").replace(/ة/g, "ه").toLowerCase();

export default function LearningMedia({ view, initialTopic }: { view: "podcasts" | "courses"; initialTopic: LearningTopic | "" }) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [topic, setTopic] = useState<LearningTopic | "">(initialTopic);
  const [limit, setLimit] = useState(pageSize);
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const searchField = useRef<HTMLInputElement>(null);
  const episode = podcasts.find(item => item.videoId === videoId);
  const showingCourses = view === "courses";
  const catalog = showingCourses ? courses : podcasts;
  const terms = normalize(search).trim().split(/\s+/).filter(Boolean);
  const results = catalog.filter(item => {
    if ((source && item.source !== source) || (topic && item.topic !== topic)) return false;
    const text = normalize([item.title, item.source, learningTopics[item.topic], item.description].join(" "));
    return terms.every(term => text.includes(term));
  });
  const shown = results.slice(0, limit);

  useEffect(() => {
    if (episode && !showingCourses) {
      heading.current?.scrollIntoView({ block: "start" });
      heading.current?.focus({ preventScroll: true });
    }
  }, [episode, showingCourses]);

  return <section className="learning-media" aria-labelledby="learning-media-title">
    <h2 id="learning-media-title">{showingCourses ? "الدورات الدينية" : "البودكاست الديني"}</h2>
    <div className="learning-media-filters">
      <label className="learning-media-search"><Search size={18} aria-hidden="true" />
        <input ref={searchField} type="search" aria-label="ابحث في التعلّم" placeholder={showingCourses ? "اسم الدورة أو موضوعها…" : "اسم الحلقة أو القناة…"}
          maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setLimit(pageSize); }} />
      </label>
      <select aria-label="الناشر" value={source} onChange={event => { setSource(event.target.value); setLimit(pageSize); }}>
        <option value="">كل الناشرين</option>
        {[...new Set(catalog.map(item => item.source))].map(name => <option key={name}>{name}</option>)}
      </select>
      <select aria-label="الموضوع" value={topic} onChange={event => { setTopic(event.target.value as LearningTopic | ""); setLimit(pageSize); }}>
        <option value="">كل المواضيع</option>
        {Object.entries(learningTopics).filter(([id]) => id === topic || catalog.some(item => item.topic === id))
          .map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </div>
    <p className="learning-media-count" role="status">
      {results.length ? `عرض ${shown.length.toLocaleString("ar-EG")} من ${results.length.toLocaleString("ar-EG")}` : "لا توجد نتائج مطابقة."}
    </p>
    {episode && !showingCourses && <section className="learning-video" aria-labelledby="learning-video-title">
      <header>
        <h3 ref={heading} tabIndex={-1} id="learning-video-title">{episode.title}</h3>
        <button type="button" aria-label="إغلاق مشغّل الحلقة" onClick={() => {
          setVideoId(null);
          (trigger.current?.isConnected ? trigger.current : searchField.current)?.focus();
        }}><X size={20} aria-hidden="true" /></button>
      </header>
      <iframe key={episode.videoId} title={episode.title}
        src={`https://www.youtube-nocookie.com/embed/${episode.videoId}?autoplay=1&rel=0`}
        referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      <a href={youtubeWatchUrl(episode.videoId)} target="_blank" rel="noopener noreferrer">
        افتح الحلقة على يوتيوب <ArrowUpLeft size={16} aria-hidden="true" />
      </a>
    </section>}
    <div className="learning-media-grid">
      {shown.map(item => <article className="learning-card learning-media-card" key={"videoId" in item ? item.videoId : item.href}>
        <div className="learning-media-source">{showingCourses ? <GraduationCap size={20} aria-hidden="true" /> : <Headphones size={20} aria-hidden="true" />}
          {item.source}<span aria-hidden="true">·</span>{learningTopics[item.topic]}
        </div>
        <h3>{item.title}</h3>
        {item.description && <p>{item.description}</p>}
        {"videoId" in item ?
        <div className="learning-media-actions">
          <button type="button" className="learning-media-action" aria-label={`شغّل حلقة ${item.title}`}
            aria-pressed={episode?.videoId === item.videoId} onClick={event => {
              trigger.current = event.currentTarget;
              if (episode?.videoId === item.videoId) {
                heading.current?.scrollIntoView({ block: "start" });
                heading.current?.focus({ preventScroll: true });
              } else setVideoId(item.videoId);
            }}><Play size={17} aria-hidden="true" /> شاهد الحلقة</button>
          <a href={youtubeWatchUrl(item.videoId)} target="_blank" rel="noopener noreferrer"
            aria-label={`افتح ${item.title} على يوتيوب`}>يوتيوب <ArrowUpLeft size={15} aria-hidden="true" /></a>
        </div> : <a className="learning-media-action" href={item.href} target="_blank" rel="noopener noreferrer"
          aria-label={`افتح ${item.title} على موقع الناشر`}>افتح على موقع الناشر <ArrowUpLeft size={16} aria-hidden="true" /></a>}
      </article>)}
    </div>
    {shown.length < results.length && <button type="button" className="learning-media-action learning-media-more"
      onClick={() => setLimit(limit + pageSize)}>عرض المزيد</button>}
    <nav className="learning-reading-links" aria-label="للقراءة">
      <BookOpen size={18} aria-hidden="true" />
      <Link href="/library">المكتبة</Link><Link href="/sunnah">السنة النبوية</Link><Link href="/seerah">السيرة النبوية</Link>
    </nav>
  </section>;
}
