import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Calculator, Check, Compass, MapPin, Moon, RotateCcw, BookOpen, Clock } from "lucide-react";
import QuranPassages from "@/components/QuranPassages";

/* ---------- Hijri ---------- */
const hijriFmt = (d = new Date()) => new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).format(d);
const daysToRamadan = () => {
  const f = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric" });
  for (let i = 0; i < 400; i++) { const p = f.formatToParts(new Date(Date.now() + i * 864e5)); const g = (t: string) => Number(p.find(x => x.type === t)?.value); if (g("month") === 9 && g("day") === 1) return i; }
  return null;
};

/* ---------- Prayer times (Egyptian General Authority: Fajr 19.5°, Isha 17.5°, Shafi'i Asr) ---------- */
type City = { name: string; lat: number; lng: number; tz?: string };
const CITIES: City[] = [
  { name: "القاهرة", lat: 30.0444, lng: 31.2357, tz: "Africa/Cairo" }, { name: "الإسكندرية", lat: 31.2001, lng: 29.9187, tz: "Africa/Cairo" },
  { name: "مكة المكرمة", lat: 21.3891, lng: 39.8579, tz: "Asia/Riyadh" }, { name: "المدينة المنورة", lat: 24.4672, lng: 39.6111, tz: "Asia/Riyadh" },
  { name: "الرياض", lat: 24.7136, lng: 46.6753, tz: "Asia/Riyadh" }, { name: "دبي", lat: 25.2048, lng: 55.2708, tz: "Asia/Dubai" },
  { name: "القدس", lat: 31.7683, lng: 35.2137, tz: "Asia/Jerusalem" }, { name: "إسطنبول", lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul" },
  { name: "الدار البيضاء", lat: 33.5731, lng: -7.5898, tz: "Africa/Casablanca" }, { name: "لندن", lat: 51.5072, lng: -0.1276, tz: "Europe/London" },
  { name: "نيويورك", lat: 40.7128, lng: -74.006, tz: "America/New_York" },
];
const rad = Math.PI / 180, deg = 180 / Math.PI;
const fix = (h: number) => ((h % 24) + 24) % 24;
const tzParts = (tz: string | undefined, d: Date) => {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(d);
  const g = (t: string) => Number(p.find(x => x.type === t)!.value);
  return { y: g("year"), m: g("month"), d: g("day"), h: g("hour") + g("minute") / 60 + g("second") / 3600 };
};
function prayerTimes(c: City, now = new Date()) {
  const loc = tzParts(c.tz, now);
  // UTC offset of the city's zone in hours: its wall-clock read as UTC minus the real instant, rounded to a quarter hour
  const offset = Math.round(((Date.UTC(loc.y, loc.m - 1, loc.d, Math.floor(loc.h), Math.round((loc.h % 1) * 60)) - Math.floor(now.getTime() / 60000) * 60000) / 3600000) * 4) / 4;
  const jd = Date.UTC(loc.y, loc.m - 1, loc.d) / 864e5 + 2440587.5 - c.lng / 360;
  const D = jd - 2451545.0, g = (357.529 + 0.98560028 * D) % 360, q = (280.459 + 0.98564736 * D) % 360;
  const L = (q + 1.915 * Math.sin(g * rad) + 0.02 * Math.sin(2 * g * rad)) % 360, e = 23.439 - 3.6e-7 * D;
  const RA = fix(Math.atan2(Math.cos(e * rad) * Math.sin(L * rad), Math.cos(L * rad)) * deg / 15);
  let eqt = q / 15 - RA; if (eqt > 12) eqt -= 24; if (eqt < -12) eqt += 24;
  const decl = Math.asin(Math.sin(e * rad) * Math.sin(L * rad)) * deg;
  const mid = 12 - eqt;
  const at = (angle: number) => { const v = (-Math.sin(angle * rad) - Math.sin(decl * rad) * Math.sin(c.lat * rad)) / (Math.cos(decl * rad) * Math.cos(c.lat * rad)); return Math.abs(v) > 1 ? NaN : deg * Math.acos(v) / 15; };
  const asrAngle = -Math.atan(1 / (1 + Math.tan(Math.abs(c.lat - decl) * rad))) * deg;
  const adj = offset - c.lng / 15;
  const t = { fajr: mid - at(19.5), sunrise: mid - at(0.833), dhuhr: mid, asr: mid + at(asrAngle), maghrib: mid + at(0.833), isha: mid + at(17.5) };
  return { times: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, fix(v + adj)])) as Record<keyof typeof t, number>, nowH: loc.h };
}
const fmtH = (h: number) => { if (Number.isNaN(h)) return "—"; const m = Math.round(h * 60) % 1440; const hh = Math.floor(m / 60), mm = m % 60; return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "م" : "ص"}`; };
const NAMES: [keyof ReturnType<typeof prayerTimes>["times"], string][] = [["fajr", "الفجر"], ["sunrise", "الشروق"], ["dhuhr", "الظهر"], ["asr", "العصر"], ["maghrib", "المغرب"], ["isha", "العشاء"]];
const qibla = (lat: number, lng: number) => { const k = [21.4225 * rad, 39.8262 * rad], p = lat * rad, dl = k[1] - lng * rad; return (Math.atan2(Math.sin(dl), Math.cos(p) * Math.tan(k[0]) - Math.sin(p) * Math.cos(dl)) * deg + 360) % 360; };
const getCity = (): City => { try { const s = JSON.parse(localStorage.getItem("city") || "null"); if (s?.name) return s; } catch {} return CITIES[0]; };
const countdown = (h: number) => { const s = Math.max(0, Math.round(h * 3600)); return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
function useNext(city: City) {
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(i); }, []);
  const { times, nowH } = prayerTimes(city);
  const list = NAMES.filter(([k]) => k !== "sunrise");
  const nx = list.find(([k]) => times[k] > nowH) ?? list[0];
  const diff = times[nx[0]] > nowH ? times[nx[0]] - nowH : times[nx[0]] + 24 - nowH;
  return { times, nextName: nx[1], left: countdown(diff) };
}

export function TodayStrip() {
  const city = useMemo(getCity, []); const n = useNext(city); const rm = useMemo(daysToRamadan, []);
  return <section className="section-wrap today-strip"><Link href="/prayer" className="today-item tool-card"><Clock size={20} /><span><small>الصلاة القادمة · {city.name}</small><b>{n.nextName} بعد {n.left}</b></span></Link><div className="today-item tool-card"><Moon size={20} /><span><small>التاريخ الهجري</small><b>{hijriFmt()}</b></span></div>{rm !== null && <div className="today-item tool-card"><BookOpen size={20} /><span><small>رمضان (تقريبًا)</small><b>{rm === 0 ? "اليوم" : `بعد ${rm} يومًا`}</b></span></div>}</section>;
}

const Crumb = ({ t }: { t: string }) => <div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} /><Link href="/tools">الأدوات</Link><ArrowLeft size={14} />{t}</div>;
export const Hero = ({ icon: I, k, t, p }: { icon: typeof Clock; k: string; t: string; p: string }) => <div className="page-hero compact"><div className="page-icon"><I size={28} /></div><span className="kicker">{k}</span><h1>{t}</h1><p>{p}</p></div>;
export function QuranQuote({ surah, ayah }: { surah: number; ayah: number }) {
  return <aside className="verified-passage tool-verse"><QuranPassages references={[{ title: "آية من كتاب الله", surah, ayah }]} compact /></aside>;
}

export function ToolsHub() {
  const tools = [
    { href: "/prayer", icon: Clock, t: "مواقيت الصلاة والقبلة", p: "مواقيت دقيقة لمدينتك وعدّاد للصلاة القادمة وبوصلة قبلة." },
    { href: "/khatma", icon: BookOpen, t: "مخطط الختمة", p: "اختر مدتك ويحسب لك ورد كل يوم، وتتبّع تقدمك." },
    { href: "/zakat", icon: Calculator, t: "حاسبة الزكاة", p: "احسب زكاة مالك بالنصاب الذي تحدده أنت." },
    { href: "/tasbih", icon: RotateCcw, t: "السبحة الإلكترونية", p: "عدّاد ذكر محفوظ على جهازك بأهداف مختلفة." },
  ];
  return <main className="section-wrap section-page"><div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} />الأدوات</div><Hero icon={Compass} k="أبواب تعين على الطاعة" t="اجعل للعبادة نصيبًا من يومك" p="مواقيت الصلاة والقبلة والذكر والختمة والزكاة؛ أدواتٌ عملية تُذكّرك بالعبادة، مع التنبيه إلى مواضع الاجتهاد وسؤال أهل العلم." /><QuranQuote surah={20} ayah={14} /><div className="tools-grid">{tools.map(x => <Link key={x.href} href={x.href} className="tool-card"><span className="tool-ic"><x.icon size={26} /></span><h3>{x.t}</h3><p>{x.p}</p><em>افتح <ArrowLeft size={14} /></em></Link>)}</div></main>;
}

export function PrayerPage() {
  const [city, setCity] = useState<City>(getCity);
  const [msg, setMsg] = useState("");
  const n = useNext(city);
  const q = qibla(city.lat, city.lng);
  const dayKey = `pr-${new Date().toISOString().slice(0, 10)}`;
  const [done, setDone] = useState<boolean[]>(() => { try { return JSON.parse(localStorage.getItem(dayKey) || "") as boolean[]; } catch { return [false, false, false, false, false]; } });
  const pick = (c: City) => { setCity(c); try { localStorage.setItem("city", JSON.stringify(c)); } catch {} };
  const locate = () => { setMsg("جارٍ تحديد موقعك…"); navigator.geolocation?.getCurrentPosition(p => { pick({ name: "موقعي", lat: p.coords.latitude, lng: p.coords.longitude }); setMsg(""); }, () => setMsg("تعذّر تحديد الموقع، اختر مدينتك من القائمة."), { timeout: 8000 }); };
  const toggle = (i: number) => { const d = done.map((x, j) => (j === i ? !x : x)); setDone(d); try { localStorage.setItem(dayKey, JSON.stringify(d)); } catch {} };
  const five = NAMES.filter(([k]) => k !== "sunrise");
  return <main className="section-wrap section-page"><Crumb t="المواقيت والقبلة" /><Hero icon={Clock} k="مواقيت الصلاة" t={`الصلاة القادمة: ${n.nextName}`} p={`بعد ${n.left} · ${hijriFmt()}`} /><QuranQuote surah={4} ayah={103} />
    <div className="pray-tools"><select aria-label="المدينة" value={CITIES.some(c => c.name === city.name) ? city.name : ""} onChange={e => { const c = CITIES.find(x => x.name === e.target.value); c && pick(c); }}>{!CITIES.some(c => c.name === city.name) && <option value="">{city.name}</option>}{CITIES.map(c => <option key={c.name}>{c.name}</option>)}</select><button className="detail-btn" onClick={locate}><MapPin size={15} /> استخدم موقعي</button>{msg && <small>{msg}</small>}</div>
    <div className="pray-grid">{NAMES.map(([k, label]) => <div key={k} className={`pray-card ${label === n.nextName ? "next" : ""}`}><small>{label}</small><b>{fmtH(n.times[k])}</b></div>)}</div>
    <div className="pray-two"><div className="pray-card wide"><h3>اتجاه القبلة</h3><div className="compass"><div className="compass-ring"><i>ش</i><i>ق</i><i>ج</i><i>غ</i><div className="needle" style={{ transform: `rotate(${q}deg)` }}><span>🕋</span></div></div></div><p>{Math.round(q)}° من الشمال باتجاه عقارب الساعة</p></div>
      <div className="pray-card wide"><h3>صلواتي اليوم</h3><div className="checks">{five.map(([, label], i) => <button key={label} className={done[i] ? "on" : ""} onClick={() => toggle(i)}><span>{done[i] && <Check size={14} />}</span>{label}</button>)}</div><p>{done.filter(Boolean).length} من 5 · محفوظ على جهازك</p></div></div>
    <p className="tool-note">الحساب فلكي بطريقة الهيئة المصرية العامة للمساحة (الفجر 19.5° والعشاء 17.5°) وقد يختلف دقيقة أو دقيقتين. للاعتماد قارنه بتقويم مسجدك أو دار الإفتاء في بلدك.</p></main>;
}

export function KhatmaPage() {
  const TOTAL = 604;
  const [days, setDays] = useState(() => Number(localStorage.getItem("kh-days")) || 30);
  const [read, setRead] = useState(() => Number(localStorage.getItem("kh-read")) || 0);
  const save = (d: number, r: number) => { setDays(d); setRead(r); try { localStorage.setItem("kh-days", String(d)); localStorage.setItem("kh-read", String(r)); } catch {} };
  const per = Math.ceil(TOTAL / days), pct = Math.min(100, (read / TOTAL) * 100), left = Math.max(0, Math.ceil((TOTAL - read) / per));
  const fin = new Date(Date.now() + left * 864e5).toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" });
  const C = 2 * Math.PI * 70;
  return <main className="section-wrap section-page"><Crumb t="مخطط الختمة" /><Hero icon={BookOpen} k="وردٌ من القرآن" t="ختمة على مقاسك" p="اختر المدة ويحسب لك ورد اليوم من مصحف المدينة (٦٠٤ صفحات). هذا مخطط شخصي للقراءة وليس حكمًا شرعيًا بمدة محددة." /><QuranQuote surah={20} ayah={114} />
    <div className="pray-two"><div className="pray-card wide"><h3>مدة الختمة</h3><div className="chips">{[7, 15, 30, 60, 90].map(d => <button key={d} className={days === d ? "active" : ""} onClick={() => save(d, read)}>{d} يومًا</button>)}</div><p className="big-num">{per} صفحة <small>في اليوم · ≈ {(30 / days).toFixed(1)} جزء</small></p></div>
      <div className="pray-card wide"><svg viewBox="0 0 160 160" className="ring"><circle cx="80" cy="80" r="70" className="ring-bg" /><circle cx="80" cy="80" r="70" className="ring-fg" strokeDasharray={C} strokeDashoffset={C - (C * pct) / 100} /><text x="80" y="88" textAnchor="middle">{Math.round(pct)}%</text></svg><p>قرأت {read} من {TOTAL} صفحة · تنتهي تقريبًا {read >= TOTAL ? "— أتممت الختمة، تقبّل الله!" : fin}</p><div className="reader-actions"><button onClick={() => save(days, Math.min(TOTAL, read + per))}>+ ورد اليوم ({per})</button><button onClick={() => save(days, Math.min(TOTAL, read + 1))}>+ صفحة</button><button onClick={() => save(days, Math.max(0, read - 1))}>− صفحة</button><button onClick={() => save(days, 0)}>تصفير</button></div></div></div></main>;
}

export function ZakatPage() {
  const [v, setV] = useState({ gold: "", cash: "", goldG: "", trade: "", debt: "" });
  const [hawlComplete, setHawlComplete] = useState(false);
  const n = (s: string) => Number(s.replace(/,/g, "")) || 0;
  const nisab = 85 * n(v.gold), total = Math.max(0, n(v.cash) + n(v.goldG) * n(v.gold) + n(v.trade) - n(v.debt));
  const eligible = n(v.gold) > 0 && total >= nisab;
  const due = eligible && hawlComplete ? total * 0.025 : 0;
  const f = (x: number) => x.toLocaleString("ar", { maximumFractionDigits: 2 });
  const F = ({ k, l, h }: { k: keyof typeof v; l: string; h?: string }) => <label>{l}<input inputMode="decimal" placeholder={h} value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} /></label>;
  return <main className="section-wrap section-page"><Crumb t="حاسبة الزكاة" /><Hero icon={Calculator} k="زكاة المال" t="قدّر زكاة مالك" p="أدخل سعر جرام الذهب اليوم بعملتك لتقدير النصاب على معيار ٨٥ جرامًا. تختلف بعض التفاصيل باختلاف نوع المال والحالة." /><QuranQuote surah={9} ayah={103} />
    <div className="pray-two"><div className="pray-card wide"><div className="form-grid"><F k="gold" l="سعر جرام الذهب عيار 24" h="مثال: 3500" /><F k="cash" l="النقد والمدخرات" /><F k="goldG" l="ذهب تدّخره (جرام 24)" /><F k="trade" l="عروض التجارة" /><F k="debt" l="ديون حالّة عليك" /></div></div>
      <div className="pray-card wide"><h3>النتيجة التقديرية</h3>{n(v.gold) === 0 ? <p>أدخل سعر الذهب أولًا.</p> : <><p className="big-num">{eligible ? hawlComplete ? f(due) : "—" : "لا يبلغ النصاب"}<small>{eligible ? hawlComplete ? " تقدير الزكاة (٢٫٥٪)" : " أكمل تأكيد الحول أولًا" : " صافي المال دون النصاب"}</small></p><p>النصاب التقديري: {f(nisab)} · صافي المال المدخل: {f(total)}</p><label className="hawl-confirm"><input type="checkbox" checked={hawlComplete} onChange={e => setHawlComplete(e.target.checked)} /> أؤكد مرور حول قمري على المال الذي تجب فيه الزكاة</label></>}</div></div>
    <p className="tool-note">هذه نتيجة تقريبية على مدخلاتك ولا تُغني عن فتوى موثوقة. تختلف أحكام الحول والديون والذهب المستعمل والأسهم والعقار؛ راجع دار الإفتاء أو عالمًا موثوقًا قبل إخراج الزكاة.</p></main>;
}
