import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import QuranReader from "@/components/QuranReader";
import AdhkarRoutine from "@/components/AdhkarRoutine";
import QuranPassages, { type QuranPassageReference } from "@/components/QuranPassages";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Bookmark, Compass, Copy, Flag, LibraryBig, Minus, Plus, Search, Star, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CONTENT_LESSONS, type CuratedLesson } from "@/data/curated-content";

const LearningPage = lazy(() => import("@/components/LearningPage"));

export const KINDS = {
  quran: { path: "/quran", label: "القرآن الكريم", title: "كلام الله يُتلى ويُتدبّر.", copy: "المصحف كاملًا بين يديك؛ تلاوة وبحث في نص محفوظ محليًا.", icon: BookOpen },
  sunnah: { path: "/sunnah", label: "السنة النبوية", title: "هدي النبي ﷺ في القول والعمل.", copy: "حديثٌ نبوي للقراءة والتعلّم من هدي رسول الله ﷺ.", icon: Star },
  library: { path: "/library", label: "المكتبة", title: "علمٌ نافع، وهدى يُتّبع.", copy: "مواد في التفسير والسيرة والعلوم الإسلامية وطلب العلم.", icon: LibraryBig },
  learning: { path: "/learning", label: "التعلّم", title: "﴿ وَقُلْ رَبِّ زِدْنِي عِلْمًا ﴾", copy: "مسارات للتعلّم الشرعي بخطوات واضحة، مع فصل الدرس عن النص المنقول.", icon: Compass },
  adhkar: { path: "/adhkar", label: "الأذكار", title: "اذكر الله بقلب حاضر.", copy: "آياتٌ وأذكارٌ تعينك على ذكر الله في يومك وليلتك.", icon: Star },
} as const;
export type Kind = keyof typeof KINDS;

const KIND_PASSAGES: Partial<Record<Kind, QuranPassageReference[]>> = {
  library: [
    { title: "السؤال لأهل العلم", surah: 16, ayah: 43 },
    { title: "التثبت من العلم", surah: 17, ayah: 36 },
  ],
  adhkar: [
    { title: "ذكر الله", surah: 33, ayah: 41 },
    { title: "طمأنينة القلوب بذكر الله", surah: 13, ayah: 28 },
    { title: "ذكر الله وشكره", surah: 2, ayah: 152 },
  ],
};

const readJson = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) || "") as T; } catch { return d; } };

function readFavorites() {
  const value = readJson<unknown>("favs", []);
  return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id) && id > 0) : [];
}

const HADITH_SECTION_LABELS = ["المتن", "الشرح", "معاني الكلمات", "الفوائد"] as const;
type HadithSection = { label: (typeof HADITH_SECTION_LABELS)[number] | null; text: string };

function formatMaterialBody(body: string): HadithSection[] {
  const withoutInternalLink = body.replace(/\n*الرابط الأصلي:\s*https?:\/\/\S+\s*$/u, "").trim();
  const marker = new RegExp(`(?:^|\\n\\n)(${HADITH_SECTION_LABELS.join("|")}):\\s*`, "gu");
  const matches = [...withoutInternalLink.matchAll(marker)];
  if (!matches.length) return [{ label: null, text: withoutInternalLink }];
  return matches.map((match, index) => ({
    label: match[1] as HadithSection["label"],
    text: withoutInternalLink.slice(match.index! + match[0].length, matches[index + 1]?.index ?? withoutInternalLink.length).trim(),
  })).filter(section => section.text);
}

function materialPreview(body: string): string {
  const sections = formatMaterialBody(body);
  return (sections.find(section => section.label === "المتن") ?? sections[0])?.text ?? "";
}

type ContentProps = { kind: Kind; omitReader?: boolean; topic?: { category: string; heading: string; hideEmpty?: boolean } };

export default function ContentPage({ kind, topic, omitReader }: ContentProps) {
  const search = useSearch();
  if (kind === "learning" && !topic && !new URLSearchParams(search).has("open")) {
    return <Suspense fallback={<p className="section-wrap" role="status">جارٍ تحميل التعلّم…</p>}><LearningPage /></Suspense>;
  }
  return <ContentSection key={topic ? kind + "/" + topic.category : kind} kind={kind} topic={topic} omitReader={omitReader} />;
}

function ContentSection({ kind, topic, omitReader }: ContentProps) {
  const meta = KINDS[kind]; const Icon = meta.icon;
  const passages = KIND_PASSAGES[kind];
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [reportNote, setReportNote] = useState("");
  const opener = useRef<HTMLButtonElement | null>(null);
  const report = trpc.content.report.useMutation({
    onSuccess: () => { setReportNote(""); toast.success("وصل بلاغك إلى فريق المراجعة"); },
    onError: error => toast.error(error.message),
  });
  const [size, setSize] = useState(() => {
    const stored = readJson<unknown>("readerSize", 22);
    return typeof stored === "number" && Number.isFinite(stored) ? Math.min(40, Math.max(16, stored)) : 22;
  });
  const [favs, setFavs] = useState(readFavorites);
  const search = useSearch();
  const pageSize = 100;
  const categories = trpc.content.categories.useQuery({ kind }, { enabled: !topic });
  const list = trpc.content.list.useInfiniteQuery({ kind, category: topic?.category ?? (cat ?? undefined), limit: pageSize, q: searchTerm || undefined }, {
    getNextPageParam: (lastPage, pages) => {
      const nextOffset = pages.length * pageSize;
      return lastPage.length === pageSize && nextOffset <= 10000 ? nextOffset : undefined;
    },
  });
  const materials = useMemo(() => {
    const merged = new Map((list.data?.pages.flat() ?? []).map(material => [material.id, material]));
    return [...merged.values()];
  }, [list.data]);
  const item = trpc.content.get.useQuery({ id: open ?? 0 }, { enabled: open !== null });
  const showMaterials = materials.length > 0 || (kind !== "quran" && (!topic?.hideEmpty || Boolean(q || searchTerm)));

  useEffect(() => { const id = Number(new URLSearchParams(search).get("open")); if (id) setOpen(id); }, [kind, search]);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchTerm(q.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [q]);
  useEffect(() => { if (item.data) { try { localStorage.setItem("lastRead", JSON.stringify({ id: item.data.id, kind: item.data.kind, title: item.data.title })); } catch { /* storage is optional */ } } }, [item.data]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null); window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);

  const cats = categories.data ?? [];
  const shown = useMemo(() => materials.filter(m => cat === null || m.category === cat), [materials, cat]);
  const toggleFav = (id: number) => { const n = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id]; setFavs(n); try { localStorage.setItem("favs", JSON.stringify(n)); } catch { /* storage is optional */ } toast(favs.includes(id) ? "أُزيلت من المفضلة" : "أُضيفت إلى المفضلة"); };
  const changeSize = (d: number) => { const n = Math.min(40, Math.max(16, size + d)); setSize(n); try { localStorage.setItem("readerSize", String(n)); } catch { /* storage is optional */ } };
  const copyMaterial = async (material: { title: string; body: string }) => {
    try {
      const text = formatMaterialBody(material.body).map(section => section.text).join("\n\n");
      await navigator.clipboard.writeText(`${material.title}\n\n${text}`);
      toast.success("تم النسخ");
    } catch {
      toast.error("تعذّر النسخ. يمكنك تحديد النص ونسخه يدويًا.");
    }
  };

  const params = new URLSearchParams(search);
  const inDhikrSession = kind === "adhkar" && ["morning", "evening", "sleep"].includes(params.get("session") ?? "");
  const Container = topic ? "section" : "main";
  const MaterialListing = kind === "quran" ? "details" : Fragment;
  if (topic?.hideEmpty && !showMaterials && open === null) return null;
  if (kind === "quran" && omitReader && !showMaterials && open === null) return null;
  return <Container className={topic ? "curated-section" : `section-wrap section-page${kind === "quran" ? " quran-mushaf-page" : ""}`}>
    {topic ? <div className="section-heading section-content-heading"><h2>{topic.heading}</h2></div> : <>
    {kind !== "quran" && <>
      <div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} />{meta.label}</div>
      <header data-section={kind} className={`launch-content-heading${inDhikrSession ? " reader-heading" : kind === "adhkar" ? " release-content-cover" : ""}`}><span className="launch-tile-icon"><Icon size={22} aria-hidden="true" /></span><div><h1>{meta.label}</h1>{!inDhikrSession && <p>{meta.copy}</p>}</div></header>
    </>}
    {kind === "quran" && !omitReader && <QuranReader />}
    {kind === "adhkar" && <AdhkarRoutine />}
    {(kind === "library" || (kind === "adhkar" && !inDhikrSession)) && <CuratedContent lessons={CONTENT_LESSONS[kind] ?? []} title={kind === "adhkar" ? "آياتٌ وأذكار للتذكّر" : "مسار تعلّم مقترح"} />}
    {kind === "learning" && <Link className="detail-btn" href="/learning">العودة إلى التعلّم <ArrowLeft size={14} /></Link>}
    {passages && !inDhikrSession && <section className="section-passage-library"><div className="section-heading section-content-heading"><div><span className="kicker">من القرآن الكريم</span><h2>آياتٌ في هذا الباب</h2></div><p>تظهر الآيات كاملةً، ويمكن فتح موضعها في المصحف داخل الموقع.</p></div><QuranPassages references={passages} /></section>}
    </>}
    {showMaterials && !inDhikrSession && <MaterialListing {...(kind === "quran" ? { className: "quran-published-materials" } : {})}>
    {kind === "quran" && <summary>الشروح والمواد المنشورة</summary>}
    <div className="content-tools">
      <div className="search-field"><Search size={17} /><input aria-label="بحث" placeholder={`ابحث في ${topic?.category ?? meta.label}…`} maxLength={100} value={q} onChange={e => { setQ(e.target.value); setCat(null); }} />{q && <button aria-label="مسح" onClick={() => { setQ(""); setCat(null); }}><X size={15} /></button>}</div>
      {!topic && <div className="chips" role="group" aria-label="التصنيفات"><button aria-pressed={cat === null} className={cat === null ? "active" : ""} onClick={() => setCat(null)}>الكل</button>{cats.map(entry => <button key={entry.category} aria-pressed={cat === entry.category} className={cat === entry.category ? "active" : ""} onClick={() => setCat(entry.category)}>{entry.category}</button>)}</div>}
    </div>
    {list.isLoading && materials.length === 0 ? <div className="card-grid">{[1, 2, 3].map(i => <div key={i} className="skeleton" />)}</div>
      : shown.length === 0 ? !list.isError && <div className="empty-box"><Icon size={30} /><h3>{searchTerm || cat !== null ? "لا نتائج مطابقة" : "لا توجد مواد منشورة بعد"}</h3><p>{searchTerm || cat !== null ? "جرّب كلمة أخرى أو اختر تصنيفًا مختلفًا." : "ستظهر هنا المواد فور اعتمادها ونشرها."}</p>{(user?.role === "admin" || user?.role === "owner") && !searchTerm && materials.length === 0 && <Link href="/dashboard" className="primary-cta">أضف أول مادة <ArrowLeft size={16} /></Link>}</div>
      : <div className="card-grid">{shown.map(m => <article key={m.id} className="mat-card">
        <div className="mat-top"><span>{m.category || meta.label}</span><button type="button" aria-label={favs.includes(m.id) ? `إزالة ${m.title} من المفضلة` : `إضافة ${m.title} إلى المفضلة`} aria-pressed={favs.includes(m.id)} onClick={() => toggleFav(m.id)}><Bookmark size={17} fill={favs.includes(m.id) ? "currentColor" : "none"} /></button></div>
        <button type="button" className="mat-card-open" aria-label={`اقرأ المادة: ${m.title}`} onClick={event => { opener.current = event.currentTarget; setOpen(m.id); }}>
          <h3>{m.title}</h3><p>{materialPreview(m.body)}{materialPreview(m.body).length >= 220 ? "…" : ""}</p>
          {kind === "sunnah" && (m.grade || m.source) && <span className="hadith-citation">{m.grade && <b>{m.grade}</b>}{m.source && <small>{m.source}</small>}</span>}
          <span className="mat-foot"><span>اقرأ <ArrowLeft size={14} /></span></span>
        </button></article>)}</div>}
    {list.isError ? <div className="empty-box" role="status"><p>تعذّر تحميل المواد.</p><button className="load-more-btn" onClick={() => void (list.isFetchNextPageError ? list.fetchNextPage() : list.refetch())}>إعادة المحاولة</button></div>
      : list.hasNextPage && <button className="load-more-btn" onClick={() => void list.fetchNextPage()} disabled={list.isFetching}>{list.isFetchingNextPage ? "جارٍ التحميل…" : "تحميل المزيد"}</button>}
    </MaterialListing>}
    <Dialog open={open !== null} onOpenChange={isOpen => { if (!isOpen) { setOpen(null); setReportNote(""); } }}>
    <DialogContent className="modal reader-modal" dir="rtl" aria-describedby={undefined} onCloseAutoFocus={event => {
      if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus(); }
    }}>
      <DialogTitle>{item.data?.title ?? "قراءة المادة"}</DialogTitle>
      <div className="reader-tools"><button aria-label="تصغير الخط" onClick={() => changeSize(-2)}><Minus size={16} /></button><span>{size}</span><button aria-label="تكبير الخط" onClick={() => changeSize(2)}><Plus size={16} /></button></div>
      {item.isLoading ? <div className="skeleton tall" /> : item.isError ? <div className="empty-state-light" role="status"><p>تعذّر تحميل المادة.</p><button className="load-more-btn" onClick={() => void item.refetch()}>إعادة المحاولة</button></div> : !item.data ? <p className="empty-state-light">هذه المادة غير متاحة.</p> : <>
        <span className="kicker">{item.data.category || meta.label}</span>
        {kind === "sunnah" && (item.data.grade || item.data.source) && <div className="hadith-citation">{item.data.grade && <b>{item.data.grade}</b>}{item.data.source && <small>{item.data.source}</small>}</div>}
        <div className="reader" style={{ fontSize: size, fontFamily: item.data.category === "أذكار قرآنية" ? '"KFGQPC Hafs", Amiri, serif' : undefined }}>{formatMaterialBody(item.data.body).map((section, index) => <section className="reader-section" key={`${section.label ?? "body"}-${index}`}><>{section.label && <h3>{section.label === "المتن" ? "نص الحديث" : section.label}</h3>}<p>{section.text}</p></></section>)}</div>
        <div className="reader-actions"><button onClick={() => void copyMaterial(item.data!)}><Copy size={15} /> نسخ</button><button aria-pressed={favs.includes(item.data.id)} onClick={() => toggleFav(item.data!.id)}><Bookmark size={15} fill={favs.includes(item.data.id) ? "currentColor" : "none"} /> مفضلة</button></div>
        <details className="material-report"><summary><Flag size={15} /> بلّغ عن خطأ</summary>
          {user ? <form onSubmit={event => { event.preventDefault(); if (item.data) report.mutate({ id: item.data.id, message: reportNote }); }}>
            <label>وضّح الخطأ <textarea minLength={10} maxLength={1000} required value={reportNote} onChange={event => setReportNote(event.target.value)} /></label>
            <button type="submit" className="detail-btn" disabled={report.isPending || reportNote.trim().length < 10}>إرسال البلاغ</button>
          </form> : <Link href="/login">سجّل الدخول لإرسال بلاغ</Link>}
        </details>
      </>}
    </DialogContent></Dialog>
  </Container>;
}

function CuratedContent({ lessons, title }: { lessons: CuratedLesson[]; title: string }) {
  if (!lessons.length) return null;
  return <section className="curated-section" aria-label={title}>
    <div className="section-heading section-content-heading"><div><span className="kicker">دليل ميثاق</span><h2>{title}</h2></div><p>خطوات وملاحظات تمهيدية واضحة، منفصلة عن نصوص الوحي.</p></div>
    <div className="curated-grid">{lessons.map((lesson, index) => <article className="curated-card" key={`${lesson.title}-${index}`}>
      <span className="curated-index">{String(index + 1).padStart(2, "0")}</span>
      {lesson.label && <span className="curated-label">{lesson.label}</span>}
      <h3>{lesson.title}</h3><p>{lesson.body}</p>
    </article>)}</div>
  </section>;
}
