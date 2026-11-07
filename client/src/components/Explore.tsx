import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, Star, Moon, Sparkles, Compass, Landmark, ScrollText, HeartHandshake, Sunrise, Baby, Trophy, CalendarDays, MapPinned, GraduationCap, Mic2, Library, Clock, Calculator, Target, Flame, RotateCcw } from "lucide-react";
import QuranPassages, { type QuranPassageReference } from "@/components/QuranPassages";

type Kind = "grid" | "steps" | "names" | "events" | "achv";
type Sec = { path: string; t: string; p: string; icon: typeof Star; c: string; kind: Kind; items?: string[]; wide?: boolean };

const EXISTING: Sec[] = [
  { path: "/quran", t: "القرآن الكريم", p: "قراءة هادئة وحفظ موضعك.", icon: BookOpen, c: "#0e5a4d", kind: "grid", wide: true },
  { path: "/sunnah", t: "السنة النبوية", p: "أحاديث للقراءة والتعلّم.", icon: Star, c: "#a8822e", kind: "grid" },
  { path: "/library", t: "المكتبة", p: "تفسير وسيرة وعلوم.", icon: Library, c: "#2f6f9f", kind: "grid" },
  { path: "/learning", t: "مسارات التعلّم", p: "دروس بخطوات واضحة.", icon: Compass, c: "#7a4fa3", kind: "grid" },
  { path: "/adhkar", t: "الأذكار", p: "أذكار اليوم والمناسبات.", icon: Sunrise, c: "#c46b2d", kind: "grid" },
  { path: "/prayer", t: "المواقيت والقبلة", p: "مواقيت دقيقة وبوصلة.", icon: Clock, c: "#0e7a6a", kind: "grid" },
  { path: "/khatma", t: "مخطط الختمة", p: "ورد يومي يناسبك.", icon: Target, c: "#8a5a2b", kind: "grid" },
  { path: "/zakat", t: "حاسبة الزكاة", p: "احسب زكاة مالك.", icon: Calculator, c: "#4f7f3a", kind: "grid" },
  { path: "/tasbih", t: "السبحة", p: "عدّاد ذكر محفوظ.", icon: RotateCcw, c: "#b8902f", kind: "grid" },
  { path: "/rafiq", t: "رفيق AI", p: "مساعد بحث وفهم.", icon: Sparkles, c: "#1f7a8c", kind: "grid" },
];

export const SECS: Sec[] = [
  { path: "/names", t: "أسماء الله الحسنى", p: "المواد قيد التوثيق قبل النشر.", icon: Sparkles, c: "#b8902f", kind: "names", wide: true },
  { path: "/events", t: "المناسبات الإسلامية", p: "عدّاد تنازلي لأقرب المناسبات.", icon: CalendarDays, c: "#0e5a4d", kind: "events" },
  { path: "/seerah", t: "السيرة النبوية", p: "خط زمني تتبعه مرحلة بمرحلة.", icon: ScrollText, c: "#8a5a2b", kind: "steps", items: ["المولد والنشأة", "البعثة ونزول الوحي", "الدعوة في مكة", "الهجرة إلى المدينة", "بناء المجتمع", "الغزوات والفتوح", "فتح مكة", "حجة الوداع"] },
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

const ALL = [...EXISTING, ...SECS];
const SECTION_PASSAGES: Record<string, QuranPassageReference[]> = {
  "/names": [
    { title: "الأسماء الحسنى", surah: 7, ayah: 180 },
    { title: "أسماء الله وصفاته", surah: 20, ayah: 8 },
    { title: "من خواتيم سورة الحشر", surah: 59, ayah: 22 },
    { title: "من خواتيم سورة الحشر", surah: 59, ayah: 23 },
    { title: "من خواتيم سورة الحشر", surah: 59, ayah: 24 },
  ],
  "/events": [
    { title: "الأهلة ومواقيت الناس", surah: 2, ayah: 189 },
    { title: "الشهور عند الله", surah: 9, ayah: 36 },
  ],
  "/seerah": [
    { title: "الاقتداء برسول الله ﷺ", surah: 33, ayah: 21 },
    { title: "خُلُق النبي ﷺ", surah: 68, ayah: 4 },
    { title: "رحمة النبي ﷺ بالمؤمنين", surah: 9, ayah: 128 },
  ],
  "/prophets": [
    { title: "قصص الأنبياء في الوحي", surah: 12, ayah: 3 },
    { title: "العبرة في قصص الرسل", surah: 11, ayah: 120 },
    { title: "دعوة الرسل", surah: 21, ayah: 25 },
  ],
  "/duas": [
    { title: "دعاء جامع في الدنيا والآخرة", surah: 2, ayah: 201 },
    { title: "طلب العلم", surah: 20, ayah: 114 },
    { title: "دعاء يونس عليه السلام", surah: 21, ayah: 87 },
    { title: "دعاء آدم وزوجه", surah: 7, ayah: 23 },
  ],
  "/ramadan": [
    { title: "فرض الصيام", surah: 2, ayah: 183 },
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
const ATLAS_GROUPS = [
  { title: "القرآن والسنة", copy: "الوحي وعلومه: القرآن والسنة والتفسير والسيرة.", items: [EXISTING[0], EXISTING[1], EXISTING[2], SECS[0]] },
  { title: "التعلّم والأسرة", copy: "تعلّم القرآن والسنة والسيرة على بصيرة.", items: [EXISTING[3], SECS[2], SECS[3], SECS[8], SECS[9], SECS[10], SECS[11]] },
  { title: "العبادة والورد اليومي", copy: "أدوات للصلاة والذكر والختمة تعين على الثبات.", items: [EXISTING[4], EXISTING[5], EXISTING[6], EXISTING[7], EXISTING[8], SECS[4], SECS[6], SECS[7]] },
  { title: "المواسم والمساعدة", copy: "مواسم إسلامية وأبواب للتذكّر والتعلّم.", items: [EXISTING[9], SECS[1], SECS[5], SECS[12]] },
];
export const isExplore = (p: string) => p === "/explore" || SECS.some(s => s.path === p);
const sty = (c: string) => ({ ["--c" as string]: c }) as React.CSSProperties;

export function Atlas() {
  return <div className="atlas-groups">{ATLAS_GROUPS.map(group => <section className="atlas-group" key={group.title}><div className="atlas-group-heading"><div><h3>{group.title}</h3><p>{group.copy}</p></div><span>{group.items.length} أقسام</span></div><div className="atlas">{group.items.map(s => <Link key={s.path} href={s.path} className="atlas-card" style={sty(s.c)}><span className="atlas-ic"><s.icon size={22} /></span><h3>{s.t}</h3><p>{s.p}</p><ArrowLeft className="atlas-go" size={17} /></Link>)}</div></section>)}</div>;
}

export function Marquee() {
  const words = ALL.map(s => s.t);
  return <div className="marquee" aria-hidden="true"><div className="marquee-track">{[...words, ...words].map((w, i) => <span key={i}>{w} <i>✦</i></span>)}</div></div>;
}


function Names() {
  return <div className="coming-panel names-review-note"><div className="coming-orbit"><Sparkles size={24} /></div><h2>الأسماء الحسنى في القرآن</h2><p>آياتٌ من كتاب الله تتناول الأسماء الحسنى، دون حصرٍ للأسماء أو إضافة معانٍ غير مذكورة هنا.</p></div>;
}

const EV = [{ t: "رأس السنة الهجرية", m: 1, d: 1 }, { t: "يوم عاشوراء", m: 1, d: 10 }, { t: "بداية رمضان", m: 9, d: 1 }, { t: "عيد الفطر", m: 10, d: 1 }, { t: "يوم عرفة", m: 12, d: 9 }, { t: "عيد الأضحى", m: 12, d: 10 }];
const daysTo = (m: number, d: number) => {
  const f = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric" });
  for (let i = 0; i < 400; i++) { const p = f.formatToParts(new Date(Date.now() + i * 864e5)); const g = (t: string) => Number(p.find(x => x.type === t)?.value); if (g("month") === m && g("day") === d) return i; }
  return null;
};
function Events({ c }: { c: string }) {
  const list = useMemo(() => EV.map(e => ({ ...e, n: daysTo(e.m, e.d) })).sort((a, b) => (a.n ?? 999) - (b.n ?? 999)), []);
  return <><p className="calendar-note">التواريخ مبنية على تقويم هجري حسابي، وقد يختلف دخول الشهر بحسب رؤية الهلال والبلد.</p><div className="ex-grid">{list.map(e => <div key={e.t} className="ex-card ev-card" style={sty(c)}><b className="ev-n">{e.n === null ? "—" : e.n === 0 ? "اليوم" : <CountUp to={e.n} />}</b><small>{e.n ? "يومًا متبقيًا" : "\u00A0"}</small><h3>{e.t}</h3></div>)}</div></>;
}

function Achv({ c }: { c: string }) {
  const [days, setDays] = useState<string[]>([]);
  useEffect(() => { try { const a: string[] = JSON.parse(localStorage.getItem("visitDays") || "[]"); const t = new Date().toISOString().slice(0, 10); if (!a.includes(t)) a.push(t); localStorage.setItem("visitDays", JSON.stringify(a)); setDays(a); } catch { /* storage unavailable */ } }, []);
  const streak = useMemo(() => { const s = new Set(days); let n = 0; const d = new Date(); while (s.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); } return n; }, [days]);
  const badges = [[1, "البداية"], [3, "ثلاثة أيام"], [7, "أسبوع كامل"], [14, "أسبوعان"], [30, "شهر من الثبات"]] as const;
  return <><div className="ex-grid"><div className="ex-card ev-card" style={sty(c)}><b className="ev-n"><CountUp to={streak} /></b><small>أيام استخدام متتابعة</small><h3><Flame size={16} /> متابعتك الشخصية</h3></div><div className="ex-card ev-card" style={sty(c)}><b className="ev-n"><CountUp to={days.length} /></b><small>إجمالي أيام الاستخدام</small><h3>على هذا الجهاز</h3></div></div><p className="calendar-note">هذا العدّاد يتابع فتح الموقع فقط؛ لا يقيس العبادة أو الأجر.</p><div className="ex-grid badge-row">{badges.map(([n, t]) => <div key={n} className={`ex-card badge ${streak >= n ? "on" : ""}`} style={sty(c)}><Trophy size={22} /><b>{t}</b><small>{n} {n === 1 ? "يوم" : "أيام"}</small></div>)}</div></>;
}

export function ExplorePage({ path }: { path: string }) {
  const sec = SECS.find(s => s.path === path);
  if (!sec) return <main className="section-wrap section-page"><div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} />كل الأقسام</div><div className="page-hero"><span className="kicker">كل ما في ميثاق</span><h1>اختر قسمك</h1><p>أقسام متكاملة للقرآن والسنة والعبادات والتعلّم والأدوات اليومية.</p></div><Atlas /></main>;
  const Icon = sec.icon;
  const passages = SECTION_PASSAGES[path] ?? [];
  return <main className={`section-wrap section-page ex-page ex-${sec.kind}`} style={sty(sec.c)}>
    <div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} /><Link href="/explore">كل الأقسام</Link><ArrowLeft size={14} />{sec.t}</div>
    <div className="page-hero ex-hero ex-cover"><Icon className="ex-bgicon" size={260} strokeWidth={0.6} /><div className="page-icon"><Icon size={28} /></div><span className="kicker">{sec.t}</span><h1>{sec.t}</h1><p>{sec.p}</p></div>
    {sec.kind === "names" && <Names />}
    {sec.kind === "events" && <Events c={sec.c} />}
    {sec.kind === "achv" && <Achv c={sec.c} />}
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

export function Stats() {
  const rows: [number, string][] = [[ALL.length, "قسمًا في الدليل"], [114, "سورة في القرآن الكريم"]];
  return <section className="section-wrap stats-band">{rows.map(([n, l]) => <div key={l}><b><CountUp to={n} /></b><span>{l}</span></div>)}</section>;
}

