import { useVisitHistory } from "@/lib/visitHistory";
import GlassHeading from "@/components/GlassHeading";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowLeft, BookOpen, Star, Moon, Sparkles, Compass, Landmark, ScrollText, HeartHandshake, Sunrise, Baby, Trophy, CalendarDays, MapPinned, GraduationCap, Mic2, Target, Flame } from "lucide-react";
import QuranPassages, { type QuranPassageReference } from "@/components/QuranPassages";
import RamadanDashboard from "@/components/RamadanDashboard";
import { getCity } from "@/components/Tools";
import { cityDate, hijriDate, localInstant } from "@shared/prayer";
import ContentPage from "@/components/ContentPage";
import SectionDirectory from "@/components/SectionDirectory";
import DivineNamesPage from "@/components/DivineNamesPage";
import { SECTION_LESSONS } from "@/data/curated-content";

const SeerahPage = lazy(() => import("@/components/SeerahPage"));

type Kind = "grid" | "steps" | "names" | "events" | "achv";
type Sec = { path: string; t: string; p: string; icon: typeof Star; c: string; kind: Kind; items?: string[]; wide?: boolean };

export const SECS: Sec[] = [
  { path: "/names", t: "أسماء الله الحسنى", p: "معاني الأسماء وأدلتها من القرآن والسنة.", icon: Sparkles, c: "#b8902f", kind: "names", wide: true },
  { path: "/events", t: "المناسبات الإسلامية", p: "عدّاد تنازلي لأقرب المناسبات.", icon: CalendarDays, c: "#0e5a4d", kind: "events" },
  { path: "/seerah", t: "السيرة النبوية", p: "خط زمني لحياة النبي ﷺ، وأبواب عن أهل بيته وشمائله وهديه.", icon: ScrollText, c: "#8a5a2b", kind: "steps" },
  { path: "/prophets", t: "قصص الأنبياء", p: "قصص مرتبة تناسب كل الأعمار.", icon: BookOpen, c: "#7a4fa3", kind: "grid", items: ["آدم", "نوح", "إبراهيم", "موسى", "عيسى", "يوسف", "يونس", "محمد ﷺ"] },
  { path: "/duas", t: "الأدعية", p: "أدعية مصنفة حسب الموقف.", icon: HeartHandshake, c: "#c46b2d", kind: "grid", items: ["أدعية الصباح", "أدعية المساء", "دعاء السفر", "دعاء الكرب", "أدعية النوم", "أدعية الطعام", "دعاء الاستخارة", "أدعية المرض"] },
  { path: "/ramadan", t: "ركن رمضان", p: "كل ما تحتاجه في الشهر الكريم.", icon: Moon, c: "#1f4f8c", kind: "grid", items: ["إمساكية رمضان", "ليلة القدر", "زكاة الفطر", "التراويح والقيام", "آداب الصيام", "الاعتكاف"] },
  { path: "/hajj", t: "الحج والعمرة", p: "المناسك خطوة بخطوة.", icon: Landmark, c: "#0e7a6a", kind: "steps", items: ["النية والإحرام", "التلبية", "طواف القدوم", "السعي بين الصفا والمروة", "يوم عرفة", "المبيت بمزدلفة", "رمي الجمرات", "النحر والحلق", "طواف الإفاضة"] },
  { path: "/salah", t: "تعلّم الصلاة", p: "من الوضوء إلى التسليم.", icon: MapPinned, c: "#2f6f9f", kind: "steps", items: ["الوضوء", "استقبال القبلة والنية", "تكبيرة الإحرام", "القراءة", "الركوع", "السجود", "الجلوس والتشهد", "التسليم"] },
  { path: "/fiqh", t: "الفقه المبسّط", p: "أبواب الفقه بلغة سهلة.", icon: GraduationCap, c: "#4f7f3a", kind: "grid", items: ["الطهارة", "الصلاة", "الزكاة", "الصيام", "الحج", "المعاملات", "الأسرة", "الآداب"] },
  { path: "/tajweed", t: "التجويد", p: "تعلّم أحكام التلاوة.", icon: Mic2, c: "#a8822e", kind: "grid", items: ["مخارج الحروف", "أحكام النون الساكنة", "أحكام الميم الساكنة", "المدود", "الوقف والابتداء", "التفخيم والترقيق"] },
  { path: "/hifz", t: "رفيق الحفظ", p: "خطة حفظ ومراجعة منتظمة.", icon: Target, c: "#0e5a4d", kind: "grid", items: ["خطة الحفظ", "جدول المراجعة", "اختبار الحفظ", "المتشابهات"] },
  { path: "/kids", t: "ركن الأطفال", p: "تعلّم بالمرح والألوان.", icon: Baby, c: "#d0577a", kind: "grid", items: ["قصص مصورة", "ألعاب ذاكرة", "أناشيد", "اختبارات ممتعة", "تلوين", "أركان الإسلام"] },
  { path: "/achievements", t: "إنجازاتك", p: "أيام متتالية وأوسمة تحفّزك.", icon: Trophy, c: "#b8902f", kind: "achv" },
];

const SECTION_PASSAGES: Record<string, QuranPassageReference[]> = {
  "/events": [
    { title: "الأهلة ومواقيت الناس", surah: 2, ayah: 189 },
    { title: "الشهور عند الله", surah: 9, ayah: 36 },
  ],
  "/seerah": [
    { title: "الاقتداء برسول الله ﷺ", surah: 33, ayah: 21 },
    { title: "خُلُق النبي ﷺ", surah: 68, ayah: 4 },
    { title: "رحمة النبي ﷺ بالمؤمنين", surah: 9, ayah: 128 },
    { title: "رحمة النبي ﷺ للعالمين", surah: 21, ayah: 107 },
  ],
  "/prophets": [
    { title: "قصص الأنبياء في الوحي", surah: 12, ayah: 3 },
    { title: "العبرة في قصص الرسل", surah: 11, ayah: 120 },
    { title: "دعوة الرسل", surah: 21, ayah: 25 },
    { title: "دعاء يونس عليه السلام", surah: 21, ayah: 87 },
  ],
  "/duas": [
    { title: "دعاء جامع في الدنيا والآخرة", surah: 2, ayah: 201 },
    { title: "طلب العلم", surah: 20, ayah: 114 },
    { title: "دعاء يونس عليه السلام", surah: 21, ayah: 87 },
    { title: "دعاء آدم وزوجه", surah: 7, ayah: 23 },
    { title: "الدعاء للوالدين", surah: 14, ayah: 41 },
    { title: "الدعاء للأزواج والذرية", surah: 25, ayah: 74 },
    { title: "الدعاء بالثبات", surah: 3, ayah: 8 },
    { title: "دعاء موسى عند طلب التيسير", surah: 20, ayah: 25 },
    { title: "تيسير الأمر", surah: 20, ayah: 26 },
    { title: "طلب البيان", surah: 20, ayah: 27 },
    { title: "تمام دعاء موسى عند طلب التيسير", surah: 20, ayah: 28 },
    { title: "الدعاء عند الركوب", surah: 43, ayah: 13 },
    { title: "تمام ذكر الركوب", surah: 43, ayah: 14 },
  ],
  "/ramadan": [
    { title: "فرض الصيام", surah: 2, ayah: 183 },
    { title: "رخصة المريض والمسافر", surah: 2, ayah: 184 },
    { title: "شهر رمضان", surah: 2, ayah: 185 },
    { title: "ليلة القدر", surah: 97, ayah: 1 },
    { title: "فضل ليلة القدر", surah: 97, ayah: 3 },
  ],
  "/hajj": [
    { title: "إتمام الحج والعمرة", surah: 2, ayah: 196 },
    { title: "آداب الحج", surah: 2, ayah: 197 },
    { title: "فرض الحج", surah: 3, ayah: 97 },
    { title: "النداء بالحج", surah: 22, ayah: 27 },
  ],
  "/salah": [
    { title: "إقامة الصلاة", surah: 2, ayah: 43 },
    { title: "مواقيت الصلاة", surah: 4, ayah: 103 },
    { title: "أوقات الصلاة", surah: 17, ayah: 78 },
  ],
  "/fiqh": [
    { title: "السؤال لأهل العلم", surah: 16, ayah: 43 },
    { title: "الوفاء بالعقود", surah: 5, ayah: 1 },
    { title: "التثبت من العلم", surah: 17, ayah: 36 },
    { title: "الرد إلى الله والرسول", surah: 4, ayah: 59 },
  ],
  "/tajweed": [
    { title: "الترتيل", surah: 73, ayah: 4 },
    { title: "تحريك اللسان بالقرآن", surah: 75, ayah: 16 },
    { title: "جمع القرآن وبيانه", surah: 75, ayah: 17 },
    { title: "قراءة القرآن", surah: 17, ayah: 106 },
  ],
  "/hifz": [
    { title: "تيسير القرآن للذكر", surah: 54, ayah: 17 },
    { title: "جمع القرآن وبيانه", surah: 75, ayah: 17 },
    { title: "حفظ الله لكتابه", surah: 15, ayah: 9 },
  ],
  "/kids": [
    { title: "من وصايا لقمان", surah: 31, ayah: 13 },
    { title: "بر الوالدين", surah: 31, ayah: 14 },
    { title: "إقامة الصلاة", surah: 31, ayah: 17 },
    { title: "حسن الخلق", surah: 31, ayah: 18 },
    { title: "الاعتدال في المشي والصوت", surah: 31, ayah: 19 },
  ],
};
export const isExplore = (p: string) => p === "/explore" || SECS.some(s => s.path === p);
const sty = (c: string) => ({ ["--c" as string]: c }) as React.CSSProperties;

function CuratedSection({ path }: { path: string }) {
  const lessons = SECTION_LESSONS[path] ?? [];
  if (!lessons.length) return null;
  return <section className="curated-section" aria-label="مواد تعليمية مختارة">
    <div className="section-heading section-content-heading"><h2>{path === "/ramadan" ? "دليل الصيام في رمضان" : "ابدأ من هنا"}</h2></div>
    <div className="curated-grid">{lessons.map((lesson, index) => <article className="curated-card" key={`${lesson.title}-${index}`}>
      <span className="curated-index">{String(index + 1).padStart(2, "0")}</span>
      {lesson.label && <span className="curated-label">{lesson.label}</span>}
      <h3>{lesson.title}</h3><p>{lesson.body}</p>
    </article>)}</div>
  </section>;
}

const EV = [{ t: "رأس السنة الهجرية", m: 1, d: 1 }, { t: "يوم عاشوراء", m: 1, d: 10 }, { t: "بداية رمضان", m: 9, d: 1 }, { t: "عيد الفطر", m: 10, d: 1 }, { t: "يوم عرفة", m: 12, d: 9 }, { t: "عيد الأضحى", m: 12, d: 10 }];
function Events({ c }: { c: string }) {
  const list = useMemo(() => {
    const city = getCity();
    const today = cityDate(city.tz, new Date());
    const formatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { timeZone: city.tz, day: "numeric", month: "numeric" });
    const remaining = new Map<string, number>();
    for (let i = 0; i < 400 && remaining.size < EV.length; i++) {
      const date = new Date(localInstant(city.tz, { ...today, d: today.d + i }, 720));
      const parts = formatter.formatToParts(hijriDate(date, city.tz, city.hijriOffset));
      const month = Number(parts.find(part => part.type === "month")?.value);
      const day = Number(parts.find(part => part.type === "day")?.value);
      const event = EV.find(entry => entry.m === month && entry.d === day);
      if (event && !remaining.has(event.t)) remaining.set(event.t, i);
    }
    return EV.map(event => ({ ...event, n: remaining.get(event.t) ?? null })).sort((a, b) => (a.n ?? 999) - (b.n ?? 999));
  }, []);
  return <><p className="calendar-note">التواريخ مبنية على تقويم هجري حسابي، وقد يختلف دخول الشهر بحسب رؤية الهلال والبلد.</p><div className="ex-grid">{list.map(e => <div key={e.t} className="ex-card ev-card" style={sty(c)}><b className="ev-n">{e.n === null ? "—" : e.n === 0 ? "اليوم" : <CountUp to={e.n} />}</b><small>{e.n ? "يومًا متبقيًا" : "\u00A0"}</small><h3>{e.t}</h3></div>)}</div></>;
}

function Achv({ c }: { c: string }) {
  const { days, streak } = useVisitHistory();
  const badges = [[1, "البداية"], [3, "ثلاثة أيام"], [7, "أسبوع كامل"], [14, "أسبوعان"], [30, "شهر من الثبات"]] as const;
  return <><div className="ex-grid"><div className="ex-card ev-card" style={sty(c)}><b className="ev-n"><CountUp to={streak} /></b><small>أيام استخدام متتابعة</small><h3><Flame size={16} /> متابعتك الشخصية</h3></div><div className="ex-card ev-card" style={sty(c)}><b className="ev-n"><CountUp to={days} /></b><small>إجمالي أيام الاستخدام</small><h3>على هذا الجهاز</h3></div></div><p className="calendar-note">هذا العدّاد يتابع فتح الموقع فقط؛ لا يقيس العبادة أو الأجر.</p><div className="ex-grid badge-row">{badges.map(([n, t]) => <div key={n} className={`ex-card badge ${streak >= n ? "on" : ""}`} style={sty(c)}><Trophy size={22} /><b>{t}</b><small>{n} {n === 1 ? "يوم" : "أيام"}</small></div>)}</div></>;
}

export function ExplorePage({ path }: { path: string }) {
  const search = useSearch();
  if (path === "/names") return <DivineNamesPage />;
  if (path === "/seerah" && !new URLSearchParams(search).has("open")) {
    return <Suspense fallback={<p className="section-wrap" role="status">جارٍ تحميل السيرة النبوية…</p>}><SeerahPage /></Suspense>;
  }
  const sec = SECS.find(s => s.path === path);
  if (!sec) return <SectionDirectory />;
  const Icon = sec.icon;
  const passages = SECTION_PASSAGES[path] ?? [];
  const courseTopic =
    path === "/salah" ? "salah" :
    path === "/tajweed" || path === "/hifz" ? "quran" :
    path === "/fiqh" || path === "/hajj" ? "fiqh" : "";
  return <main className={`section-wrap section-page ex-page ${sec.kind === "grid" ? "" : `ex-${sec.kind}`}`} style={sty(sec.c)}>
    <div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} /><Link href="/explore">استكشف</Link><ArrowLeft size={14} />{sec.t}</div>
    <GlassHeading icon={Icon} title={sec.t} description={sec.p} action={courseTopic
      ? <Link href={`/learning?view=courses&topic=${courseTopic}`} className="detail-btn">دورات في هذا الموضوع <ArrowLeft size={16} aria-hidden="true" /></Link>
      : undefined} />
    {path === "/ramadan" && <RamadanDashboard />}
    <CuratedSection path={path} />
    {sec.kind === "events" && <Events c={sec.c} />}
    {sec.kind === "achv" && <Achv c={sec.c} />}
    {sec.kind !== "achv" && (path === "/duas"
      ? <ContentPage kind="adhkar" topic={{ category: "أدعية مأثورة", heading: "أدعية من السنة" }} />
      : <ContentPage kind="learning" topic={{ category: sec.t, heading: path === "/seerah" ? "محطات السيرة بالترتيب" : "مواد منشورة", hideEmpty: true }} />)}
    {passages.length > 0 && <section className="section-passage-library"><div className="section-heading section-content-heading"><div><span className="kicker">من القرآن الكريم</span><h2>آياتٌ في هذا الباب</h2></div><p>اقرأ الآيات كاملةً داخل المصحف، ثم تابع تعلّمك مع أهل العلم.</p></div><QuranPassages references={passages} /></section>}
  </main>;
}

export function CountUp({ to, ms = 1300 }: { to: number; ms?: number }) {
  const [v, setV] = useState(0);
  const [ref, setRef] = useState<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!ref) return;
    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) { setV(to); return; }
    let raf = 0;
    const io = new IntersectionObserver(es => { if (!es[0].isIntersecting) return; io.disconnect(); const t0 = performance.now(); const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); });
    io.observe(ref);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [ref, to, ms]);
  return <span ref={setRef}>{v}</span>;
}
