import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import QuranReader from "@/components/QuranReader";
import QuranPassages, { type QuranPassageReference } from "@/components/QuranPassages";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Bookmark, Compass, Copy, LibraryBig, Minus, Plus, Search, Star, X } from "lucide-react";

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
  learning: [
    { title: "طلب العلم", surah: 20, ayah: 114 },
    { title: "فضل أهل العلم", surah: 39, ayah: 9 },
    { title: "رفعة أهل الإيمان والعلم", surah: 58, ayah: 11 },
  ],
  adhkar: [
    { title: "ذكر الله", surah: 33, ayah: 41 },
    { title: "طمأنينة القلوب بذكر الله", surah: 13, ayah: 28 },
    { title: "ذكر الله وشكره", surah: 2, ayah: 152 },
  ],
};

const readJson = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) || "") as T; } catch { return d; } };

export default function ContentPage({ kind }: { kind: Kind }) {
  const meta = KINDS[kind]; const Icon = meta.icon;
  const passages = KIND_PASSAGES[kind];
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("الكل");
  const [open, setOpen] = useState<number | null>(null);
  const [size, setSize] = useState(() => readJson("readerSize", 22));
  const [favs, setFavs] = useState<number[]>(() => readJson("favs", []));
  const search = useSearch();
  const list = trpc.content.list.useQuery({ kind });
  const item = trpc.content.get.useQuery({ id: open ?? 0 }, { enabled: open !== null });
  const showMaterials = (list.data?.length ?? 0) > 0 || (!passages && kind !== "quran" && kind !== "sunnah");

  useEffect(() => { const id = Number(new URLSearchParams(search).get("open")); if (id) setOpen(id); }, [kind, search]);
  useEffect(() => { if (item.data) localStorage.setItem("lastRead", JSON.stringify({ id: item.data.id, kind: item.data.kind, title: item.data.title })); }, [item.data]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null); window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);

  const cats = useMemo(() => ["الكل", ...Array.from(new Set((list.data ?? []).map(m => m.category).filter(Boolean) as string[]))], [list.data]);
  const shown = useMemo(() => (list.data ?? []).filter(m => (cat === "الكل" || m.category === cat) && `${m.title} ${m.body} ${m.category ?? ""}`.includes(q.trim())), [list.data, cat, q]);
  const toggleFav = (id: number) => { const n = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id]; setFavs(n); localStorage.setItem("favs", JSON.stringify(n)); toast(favs.includes(id) ? "أُزيلت من المفضلة" : "أُضيفت إلى المفضلة"); };
  const changeSize = (d: number) => { const n = Math.min(40, Math.max(16, size + d)); setSize(n); localStorage.setItem("readerSize", String(n)); };

  return <main className="section-wrap section-page">
    <div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} />{meta.label}</div>
    <div className={`page-hero compact content-hero content-hero-${kind}`}><div className="page-icon"><Icon size={28} /></div><span className="kicker">{meta.label}</span><h1>{meta.title}</h1><p>{meta.copy}</p></div>
    {kind === "quran" && <QuranReader />}
    {kind === "sunnah" && <SunnahStarter />}
    {passages && <section className="section-passage-library"><div className="section-heading section-content-heading"><div><span className="kicker">من القرآن الكريم</span><h2>آياتٌ في هذا الباب</h2></div><p>تظهر الآيات كاملةً، ويمكن فتح موضعها في المصحف داخل الموقع.</p></div><QuranPassages references={passages} /></section>}
    {showMaterials && <>
    {kind === "quran" && <div className="section-heading quran-extra-heading"><div><span className="kicker">مواد مِيثَاق الإضافية</span><h2>شروحٌ وموادٌ يضيفها المالك</h2></div><p>تظهر هنا المواد الإضافية المعتمدة إلى جانب المصحف الكامل.</p></div>}
    <div className="content-tools">
      <div className="search-field"><Search size={17} /><input aria-label="بحث" placeholder={`ابحث في ${meta.label}…`} value={q} onChange={e => setQ(e.target.value)} />{q && <button aria-label="مسح" onClick={() => setQ("")}><X size={15} /></button>}</div>
      <div className="chips" role="tablist">{cats.map(c => <button key={c} className={cat === c ? "active" : ""} onClick={() => setCat(c)}>{c}</button>)}</div>
    </div>
    {list.isLoading ? <div className="card-grid">{[1, 2, 3].map(i => <div key={i} className="skeleton" />)}</div>
      : shown.length === 0 ? <div className="empty-box"><Icon size={30} /><h3>{(list.data?.length ?? 0) === 0 ? "لا توجد مواد منشورة بعد" : "لا نتائج مطابقة"}</h3><p>{(list.data?.length ?? 0) === 0 ? "ستظهر هنا المواد فور اعتمادها ونشرها." : "جرّب كلمة أخرى أو اختر تصنيفًا مختلفًا."}</p>{user?.role === "admin" && (list.data?.length ?? 0) === 0 && <Link href="/dashboard" className="primary-cta">أضف أول مادة <ArrowLeft size={16} /></Link>}</div>
      : <div className="card-grid">{shown.map(m => <article key={m.id} className="mat-card" onClick={() => setOpen(m.id)} tabIndex={0} onKeyDown={e => e.key === "Enter" && setOpen(m.id)}>
        <div className="mat-top"><span>{m.category || meta.label}</span><button aria-label="مفضلة" onClick={e => { e.stopPropagation(); toggleFav(m.id); }}><Bookmark size={17} fill={favs.includes(m.id) ? "currentColor" : "none"} /></button></div>
        <h3>{m.title}</h3><p>{m.body}{m.body.length >= 220 ? "…" : ""}</p>
        <div className="mat-foot"><span>اقرأ <ArrowLeft size={14} /></span></div></article>)}</div>}
    </>}
    {open !== null && <div className="modal-back" onClick={() => setOpen(null)}><div className="modal reader-modal" role="dialog" aria-modal onClick={e => e.stopPropagation()}>
      <div className="modal-head"><div className="reader-tools"><button aria-label="تصغير الخط" onClick={() => changeSize(-2)}><Minus size={16} /></button><span>{size}</span><button aria-label="تكبير الخط" onClick={() => changeSize(2)}><Plus size={16} /></button></div><button className="icon-btn" aria-label="إغلاق" onClick={() => setOpen(null)}><X size={20} /></button></div>
      {item.isLoading ? <div className="skeleton tall" /> : !item.data ? <p className="empty-state-light">هذه المادة غير متاحة.</p> : <>
        <span className="kicker">{item.data.category || meta.label}</span><h2>{item.data.title}</h2>
        <div className="reader" style={{ fontSize: size }}>{item.data.body}</div>
        <div className="reader-actions"><button onClick={() => { navigator.clipboard?.writeText(`${item.data!.title}\n\n${item.data!.body}`); toast.success("تم النسخ"); }}><Copy size={15} /> نسخ</button><button onClick={() => toggleFav(item.data!.id)}><Bookmark size={15} fill={favs.includes(item.data.id) ? "currentColor" : "none"} /> مفضلة</button></div></>}
    </div></div>}
  </main>;
}

function SunnahStarter() {
  return <section className="sunnah-starter" aria-labelledby="sunnah-starter-title" lang="ar" dir="rtl">
    <article className="hadith-local-card">
      <h2 id="sunnah-starter-title">كيف كان بدء الوحي إلى رسول الله ﷺ</h2>
      <p className="hadith-narrator">عن عمر بن الخطاب رضي الله عنه.</p>
      <blockquote>إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى دُنْيَا يُصِيبُهَا أَوْ إِلَى امْرَأَةٍ يَنْكِحُهَا فَهِجْرَتُهُ إِلَى مَا هَاجَرَ إِلَيْهِ</blockquote>
    </article>
  </section>;
}
