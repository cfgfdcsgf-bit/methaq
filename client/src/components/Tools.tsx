import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowLeft, Bell, Calculator, CalendarDays, ChevronDown, Clock, Compass, LocateFixed, MapPin, Moon, RotateCcw, BookOpen, Settings2, Sun, Sunrise, Sunset, Volume2 } from "lucide-react";
import KhatmaMeter from "@/components/KhatmaMeter";
import QuranPassages from "@/components/QuranPassages";
import ContentPage from "@/components/ContentPage";
import { METHODS, PRAYERS, calculationMethod, cityDate, localInstant, prayerTimes, ramadanDaysLeft, type PrayerCity, type PrayerKey } from "@shared/prayer";
import CompassDial from "@/components/CompassDial";
import PrayerLogCard from "@/components/PrayerLogCard";
import { logDate } from "@/lib/prayerLog";
import { syncReminderLocation } from "@/lib/reminders";
import { arNumber, dailyPortion, MUSHAF_PAGES, planKhatma, readPlan, recordPages, wardUrl } from "@/lib/khatma";

/* ---------- Prayer times (Egyptian General Authority: Fajr 19.5°, Isha 17.5°, Shafi'i Asr) ---------- */
type City = PrayerCity & { name: string; iqama?: Partial<Record<Exclude<PrayerKey, "sunrise">, number>> };
const CITIES: City[] = [
  { name: "القاهرة", lat: 30.0444, lng: 31.2357, tz: "Africa/Cairo" }, { name: "الإسكندرية", lat: 31.2001, lng: 29.9187, tz: "Africa/Cairo" },
  { name: "مكة المكرمة", lat: 21.3891, lng: 39.8579, tz: "Asia/Riyadh" }, { name: "المدينة المنورة", lat: 24.4672, lng: 39.6111, tz: "Asia/Riyadh" },
  { name: "الرياض", lat: 24.7136, lng: 46.6753, tz: "Asia/Riyadh" }, { name: "دبي", lat: 25.2048, lng: 55.2708, tz: "Asia/Dubai" },
  { name: "القدس", lat: 31.7683, lng: 35.2137, tz: "Asia/Jerusalem" }, { name: "إسطنبول", lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul" },
  { name: "الدار البيضاء", lat: 33.5731, lng: -7.5898, tz: "Africa/Casablanca" }, { name: "لندن", lat: 51.5072, lng: -0.1276, tz: "Europe/London" },
  { name: "نيويورك", lat: 40.7128, lng: -74.006, tz: "America/New_York" },
];
const rad = Math.PI / 180, deg = 180 / Math.PI;
const fmtH = (h: number) => { if (Number.isNaN(h)) return "—"; const m = Math.round(h * 60) % 1440; const hh = Math.floor(m / 60), mm = m % 60; return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "م" : "ص"}`; };
const NAMES: ReadonlyArray<readonly [PrayerKey, string]> = [PRAYERS[0], ["sunrise", "الشروق"], ...PRAYERS.slice(1)];
const qibla = (lat: number, lng: number) => { const k = [21.4225 * rad, 39.8262 * rad], p = lat * rad, dl = k[1] - lng * rad; return (Math.atan2(Math.sin(dl), Math.cos(p) * Math.tan(k[0]) - Math.sin(p) * Math.cos(dl)) * deg + 360) % 360; };
export const getCity = (): City => {
  try {
    const saved = JSON.parse(localStorage.getItem("city") ?? "null");
    if (typeof saved?.name === "string" && Number.isFinite(saved.lat) && Math.abs(saved.lat) <= 90 && Number.isFinite(saved.lng) && Math.abs(saved.lng) <= 180) {
      const city: City = { ...saved, tz: saved.tz || Intl.DateTimeFormat().resolvedOptions().timeZone };
      cityDate(city.tz, new Date());
      if (city.method && !Object.hasOwn(METHODS, city.method)) delete city.method;
      if (city.hijriOffset !== -1 && city.hijriOffset !== 1) delete city.hijriOffset;
      return city;
    }
  } catch {}
  return CITIES[0];
};
const countdown = (h: number) => { const s = Math.max(0, Math.round(h * 3600)); return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
export function useNext(city: City) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const interval = setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", update); };
  }, []);
  const minute = Math.floor(now.getTime() / 60_000);
  const schedule = useMemo(() => {
    const date = new Date(minute * 60_000);
    const today = prayerTimes(city, date);
    const tomorrow = new Date(localInstant(city.tz, { ...today.loc, d: today.loc.d + 1 }, 720));
    const next = today.events.find(event => event.at > date.getTime()) ?? prayerTimes(city, tomorrow).events[0];
    return { ...today, next };
  }, [city, minute]);
  return { ...schedule, now, nextName: schedule.next?.label ?? "غير متاحة", left: schedule.next ? countdown((schedule.next.at - now.getTime()) / 3_600_000) : "—" };
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

const prayerIcons = { fajr: Sunrise, sunrise: Sunrise, dhuhr: Sun, asr: Sun, maghrib: Sunset, isha: Moon };

export function PrayerPage() {
  const [city, setCity] = useState<City>(getCity);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<PrayerKey | null>(null);
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  const audioFirst = new URLSearchParams(useSearch()).get("adhan") === "1";
  useEffect(() => {
    const failed = () => setMessage("حُفظت المواقيت على الجهاز. أعِد حفظ التنبيهات لتحديث مدينتها.");
    window.addEventListener("reminder-sync-failed", failed);
    return () => window.removeEventListener("reminder-sync-failed", failed);
  }, []);
  const n = useNext(city);
  const now = n.now.getTime();
  const active = selected ?? n.next?.prayer ?? "fajr";
  const nextToday = n.events.some(event => event.at === n.next?.at);
  const previous = n.events.findLast(event => event.at <= now);
  const progress = previous && n.next ? Math.min(1, Math.max(0, (now - previous.at) / (n.next.at - previous.at))) : null;
  const label = NAMES.find(([key]) => key === active)?.[1] ?? "";
  const iqama = active === "sunrise" ? undefined : city.iqama?.[active];
  const method = calculationMethod(city);
  const date = new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", timeZone: city.tz }).format(n.now);
  const time = n.next ? new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit", timeZone: city.tz }).format(n.next.at) : null;
  const pick = (value: City) => {
    setCity(value);
    try { localStorage.setItem("city", JSON.stringify(value)); } catch {}
    window.dispatchEvent(new Event("meethaq-city-change"));
    void syncReminderLocation(value);
  };
  const locate = () => {
    const unavailable = () => setMessage("تعذّر تحديد موقعك، اختر مدينتك من القائمة.");
    if (!navigator.geolocation) return unavailable();
    setMessage("جارٍ تحديد موقعك…");
    navigator.geolocation.getCurrentPosition(position => {
      pick({ name: "موقعي", lat: Number(position.coords.latitude.toFixed(3)), lng: Number(position.coords.longitude.toFixed(3)), tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
      setMessage("");
    }, unavailable, { timeout: 8000 });
  };
  const player = <section className="companion-panel adhan-player" id="adhan" aria-labelledby="adhan-title"><div className="companion-panel-head"><span className="launch-tile-icon"><Volume2 size={19} /></span><div><h2 id="adhan-title">الاستماع إلى الأذان</h2><p>بصوت عاصم جاويد</p></div></div><audio src="/adhan.mp3" preload="none" controls aria-label="مشغّل الأذان" /></section>;
  return <main className="section-wrap companion-page prayer-page">
    <header className="companion-heading">
      <div><p className="launch-date"><CalendarDays size={16} />{date}</p><h1>الصلاة والقبلة</h1></div>
      <Link className="companion-link" href="/settings"><Bell size={17} /> التنبيهات</Link>
    </header>
    {audioFirst && player}
    <div className="prayer-overview">
      <section className="prayer-cover" data-glass-light aria-labelledby="next-prayer-title">
        <div className="launch-arch" aria-hidden="true" />
        <div className="prayer-cover-body">
          <p className="launch-kicker"><Clock size={17} /> الصلاة القادمة</p>
          <div className="prayer-cover-title"><h2 id="next-prayer-title">{n.nextName}</h2>{time && <span>{time}{nextToday ? "" : " غدًا"}</span>}</div>
          <div className="prayer-count"><time dir="ltr" aria-label="الوقت المتبقي للصلاة">{n.left}</time><span>الوقت المتبقي</span></div>
          {progress !== null && <progress className="prayer-elapsed" max={1} value={progress} aria-label="الوقت المنقضي منذ الموعد السابق" />}
          <div className="prayer-cover-actions"><a href="#qibla"><Compass size={17} /> اتجاه القبلة</a><a href="#salah-log"><CalendarDays size={17} /> سجّل صلاتك</a></div>
        </div>
      </section>
      <section className="companion-panel prayer-location" aria-labelledby="prayer-location-title">
        <div className="companion-panel-head"><span className="launch-tile-icon"><MapPin size={19} /></span><div><h2 id="prayer-location-title">مدينتك</h2><p>{METHODS[method].label}</p></div></div>
        <div className="prayer-city-controls"><select aria-label="المدينة" value={CITIES.some(c => c.name === city.name) ? city.name : ""} onChange={event => { const value = CITIES.find(c => c.name === event.target.value); if (value) { setMessage(""); pick(value); } }}>
          {!CITIES.some(c => c.name === city.name) && <option value="">{city.name}</option>}
          {CITIES.map(value => <option key={value.name}>{value.name}</option>)}
        </select><button className="companion-link" type="button" onClick={locate}><LocateFixed size={18} /> استخدم موقعي</button></div>
        {message && <p className="companion-private" role="status">{message}</p>}
        <details className="prayer-tuning">
          <summary><Settings2 size={18} /> طريقة الحساب والضبط <ChevronDown size={17} /></summary>
          <div className="prayer-tuning-fields">
            <label>طريقة الحساب <select value={method} onChange={event => pick({ ...city, method: event.target.value as keyof typeof METHODS })}>{Object.entries(METHODS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
            <label>حساب العصر <select value={city.hanafi ? "hanafi" : "standard"} onChange={event => pick({ ...city, hanafi: event.target.value === "hanafi" })}><option value="standard">الجمهور</option><option value="hanafi">الحنفي</option></select></label>
            <label>ضبط التاريخ الهجري <select value={city.hijriOffset ?? 0} onChange={event => pick({ ...city, hijriOffset: Number(event.target.value) as -1 | 0 | 1 })}>
              <option value={-1}>تأخير التاريخ يومًا</option><option value={0}>تقويم أم القرى</option><option value={1}>تقديم التاريخ يومًا</option>
            </select></label>
            <fieldset><legend>ضبط الفروق بالدقائق</legend>{NAMES.map(([key, name]) => <label key={key}>{name}<input type="number" min={-30} max={30} value={city.offsets?.[key] ?? 0} onChange={event => pick({ ...city, offsets: { ...city.offsets, [key]: Math.round(Math.min(30, Math.max(-30, Number(event.target.value) || 0))) } })} /></label>)}</fieldset>
            <fieldset><legend>الإقامة بعد الأذان بالدقائق</legend>{PRAYERS.map(([key, name]) => <label key={key}>{name}<input type="number" min={0} max={90} placeholder="—" value={city.iqama?.[key] ?? ""} onChange={event => {
              const value = event.target.value === "" ? undefined : Math.round(Math.min(90, Math.max(0, Number(event.target.value) || 0)));
              pick({ ...city, iqama: { ...city.iqama, [key]: value } });
            }} /></label>)}</fieldset>
            <p className="tool-note">المواقيت محسوبة فلكيًا حسب المدينة. يمكنك ضبط الفروق لتوافق تقويم مسجدك.</p>
          </div>
        </details>
      </section>
    </div>
    <section className="companion-panel prayer-times" aria-labelledby="prayer-times-title">
      <div className="companion-panel-head"><span className="launch-tile-icon"><Clock size={19} /></span><div><h2 id="prayer-times-title">مواقيت اليوم</h2><p>{city.name}</p></div></div>
      <div className="prayer-times-grid" role="group" aria-label="اختيار الموعد">
        {NAMES.map(([key, name]) => {
          const Icon = prayerIcons[key];
          return <button type="button" key={key} aria-pressed={active === key} aria-label={name} onClick={() => setSelected(key)}><Icon size={21} aria-hidden="true" /><span>{name}</span><b dir="auto">{fmtH(n.times[key])}</b></button>;
        })}
      </div>
      <div className="prayer-time-detail" key={active} role="status"><b>{label} · {fmtH(n.times[active])}</b><span>{active === "sunrise" ? "موعد الشروق" : n.next?.prayer === active && nextToday ? "الصلاة القادمة" : "بتوقيت " + city.name}</span>
        {Number.isFinite(iqama) && Number.isFinite(n.times[active]) && <span>الإقامة حسب ضبطك · {fmtH(n.times[active] + iqama! / 60)}</span>}
      </div>
    </section>
    <details className="companion-panel prayer-monthly" onToggle={event => setMonthlyOpen(event.currentTarget.open)}>
      <summary>جدول الصلاة الشهري</summary>
      {monthlyOpen && <MonthlyPrayerTimes city={city} year={n.loc.y} month={n.loc.m} />}
    </details>
    <div className="prayer-more"><CompassDial bearing={qibla(city.lat, city.lng)} /><PrayerLogCard today={logDate(n.loc)} /></div>
    {!audioFirst && player}
    <details className="companion-panel prayer-guide"><summary>دليل المواقيت والقبلة <ChevronDown size={18} /></summary><QuranQuote surah={4} ayah={103} /><ContentPage kind="learning" topic={{ category: "المواقيت والقبلة", heading: "مواد للقراءة" }} /></details>
  </main>;
}

function MonthlyPrayerTimes({ city, year, month }: { city: City; year: number; month: number }) {
  const [period, setPeriod] = useState(`${year}-${String(month).padStart(2, "0")}`);
  const [selectedYear, selectedMonth] = period.split("-").map(Number);
  const rows = useMemo(() => {
    const days = new Date(Date.UTC(selectedYear, selectedMonth, 0)).getUTCDate();
    const label = new Intl.DateTimeFormat("ar-EG", { timeZone: city.tz, day: "numeric", weekday: "short" });
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(localInstant(city.tz, { y: selectedYear, m: selectedMonth, d: index + 1 }, 720));
      return { day: label.format(date), times: prayerTimes(city, date).times };
    });
  }, [city, selectedYear, selectedMonth]);
  return <div className="prayer-monthly-print">
    <h2>مواقيت الصلاة · {city.name} · <bdi>{period}</bdi></h2>
    <div className="prayer-monthly-actions"><label>الشهر <input type="month" value={period} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) setPeriod(event.target.value); }} /></label>
      <button type="button" className="detail-btn" onClick={() => window.print()}>طباعة الجدول</button></div>
    <div className="ramadan-times"><table>
      <thead><tr><th scope="col">اليوم</th>{NAMES.map(([key, title]) => <th scope="col" key={key}>{title}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.day}><th scope="row">{row.day}</th>{NAMES.map(([key]) => <td key={key}>{fmtH(row.times[key])}</td>)}</tr>)}</tbody>
    </table></div>
  </div>;
}

export function KhatmaPage() {
  const seasonal = new URLSearchParams(useSearch()).get("season") === "ramadan";
  const [plan, setPlan] = useState(readPlan);
  const [suggested] = useState(() => {
    const city = getCity();
    return seasonal ? ramadanDaysLeft(city.tz, new Date(), city.hijriOffset) : 30;
  });
  const [days, setDays] = useState(() => plan?.days ?? suggested);
  const [editing, setEditing] = useState(!plan);
  const portion = plan && dailyPortion(plan);
  const complete = plan?.read === MUSHAF_PAGES;
  const remainingDays = plan ? Math.max(0, plan.end - plan.day + 1) : 0;
  const dailyEstimate = Math.ceil((MUSHAF_PAGES - (plan?.baseline ?? 0)) / Math.max(1, days));
  const adjust = () => { setPlan(planKhatma(days)); setEditing(false); };
  return <main className="section-wrap companion-page khatma-page khatma-journey">
    <header className="khatma-scene" data-glass-light>
      <div className="khatma-scene-copy">
        <p className="launch-kicker"><BookOpen size={17} aria-hidden="true" /> {seasonal ? "ختمة رمضان" : "ختمتي"}</p>
        <h1>رحلتك مع القرآن</h1>
        <p>{plan ? <>قرأت <bdi dir="ltr">{arNumber(plan.read)}</bdi> من <bdi dir="ltr">{arNumber(MUSHAF_PAGES)}</bdi> صفحة، ووردك اليومي محسوب من المصحف.</> : "اختر مدة تناسب يومك، وسنقسّم المصحف إلى ورد واضح تتابعه صفحةً صفحة."}</p>
        {plan && portion && !complete && !portion.overdue && <Link className="khatma-hero-action" href={wardUrl(plan)}>{portion.remaining ? "ابدأ القراءة" : "افتح المصحف"} <ArrowLeft size={17} aria-hidden="true" /></Link>}
        {complete && <p className="khatma-complete-note">أتممت صفحات المصحف كاملةً، تقبّل الله منك.</p>}
        {portion?.overdue && <p className="khatma-complete-note">انتهت مدة خطتك؛ غيّر المدة لتوزيع الورد المتبقي.</p>}
      </div>
      {plan && <div className="khatma-scene-progress">
        <KhatmaMeter pages={plan.read} />
        <div><span>التقدّم الكلي</span><strong>{arNumber(plan.read)} <small>من {arNumber(MUSHAF_PAGES)} صفحة</small></strong></div>
      </div>}
    </header>
    <div className={`khatma-layout${plan ? "" : " is-planning"}`}>
      {plan && portion && <section className="companion-panel khatma-today-card" aria-labelledby="khatma-today-title">
        <div className="companion-panel-head"><span className="launch-tile-icon"><BookOpen size={21} aria-hidden="true" /></span><div><h2 id="khatma-today-title">ورد اليوم</h2><p>{portion.overdue ? "مدّد الخطة وواصل من موضعك" : <>من الصفحة <bdi dir="ltr">{arNumber(portion.first)}</bdi> إلى <bdi dir="ltr">{arNumber(portion.last)}</bdi></>}</p></div></div>
        <div className={`khatma-daily-target${portion.remaining === 0 ? " is-done" : ""}`} aria-live="polite">
          <strong>{complete ? "أتممت الختمة" : portion.overdue ? "انتهت مدة الخطة" : portion.remaining ? arNumber(portion.remaining) : "تمّ ورد اليوم"}</strong>
          {!complete && !portion.overdue && portion.remaining > 0 && <span>صفحة متبقية اليوم</span>}
        </div>
        {!complete && !portion.overdue && <div className="khatma-day-progress">
          <progress className="daily-progress" max={Math.max(1, portion.goal)} value={Math.min(portion.readToday, portion.goal)} aria-label="تقدّم ورد اليوم" />
          <span><bdi dir="ltr">{arNumber(Math.min(portion.readToday, portion.goal))}</bdi> من <bdi dir="ltr">{arNumber(portion.goal)}</bdi> صفحة</span>
        </div>}
        <div className="khatma-reading-actions">
          {!complete && !portion.overdue && <Link href={wardUrl(plan)} className="primary-cta">{portion.remaining ? "ابدأ القراءة" : "افتح المصحف"} <ArrowLeft size={16} aria-hidden="true" /></Link>}
          <div className="reader-actions"><button disabled={complete || portion.overdue || !portion.remaining} onClick={() => setPlan(recordPages("today"))}>سجّل ورد اليوم</button><button aria-label="تسجيل صفحة مقروءة" disabled={complete} onClick={() => setPlan(recordPages(1))}>+ صفحة</button><button aria-label="التراجع عن صفحة" disabled={!plan.read} onClick={() => setPlan(recordPages(-1))}>− صفحة</button></div>
        </div>
      </section>}
      <section className="companion-panel khatma-options" id="khatma-plan" aria-labelledby="khatma-plan-title">
        <div className="companion-panel-head"><span className="launch-tile-icon"><CalendarDays size={21} aria-hidden="true" /></span><div><h2 id="khatma-plan-title">{editing ? (plan ? "عدّل خطتك" : "اختر مدة الختمة") : "خطتك"}</h2><p>{editing ? "اختر وتيرة تناسب يومك." : "كل يوم له ورد واضح، ويمكنك تغيير المدة متى احتجت."}</p></div></div>
        {editing ? <><div className="chips" role="group" aria-label="مدة الخطة">{[...new Set([7, 15, 30, 60, 90, suggested, plan?.days ?? 30])].sort((a, b) => a - b).map(value => <button key={value} aria-pressed={days === value} className={days === value ? "active" : ""} onClick={() => setDays(value)}>{arNumber(value)} يومًا{seasonal && value === suggested ? " · رمضان" : ""}</button>)}</div>
        <p className="khatma-estimate" aria-live="polite">معدل الورد: <strong>{arNumber(dailyEstimate)}</strong> صفحة يوميًا</p>
        <button className="primary-cta" onClick={adjust}>{plan ? "حفظ المدة الجديدة" : "ابدأ الخطة"} <ArrowLeft size={16} aria-hidden="true" /></button></> : <>
        <div className="khatma-plan-summary"><div><span>مدة الخطة</span><strong>{arNumber(plan!.days)} يومًا</strong></div><div><span>الأيام الباقية</span><strong>{complete ? "اكتملت" : portion?.overdue ? "انتهت" : arNumber(remainingDays)}</strong></div><div><span>باقي المصحف</span><strong>{arNumber(MUSHAF_PAGES - (plan?.read ?? 0))} صفحة</strong></div></div>
        {!complete && <button className="detail-btn" onClick={() => setEditing(true)}>تغيير مدة الختمة</button>}
        {plan && <details className="khatma-reset"><summary>بدء ختمة جديدة</summary><p>سيُصفّر تقدّم الختمة الحالية.</p><button className="detail-btn" onClick={() => { setPlan(planKhatma(days, true)); setEditing(false); }}>ابدأ من الصفحة الأولى</button></details>}
        </>}
      </section>
    </div>
  </main>;
}

const ZAKAT_FIELDS = [
  { key: "gold", label: "سعر جرام الذهب عيار 24", placeholder: "مثال: 3500" },
  { key: "cash", label: "النقد والمدخرات" },
  { key: "goldG", label: "ذهب تدّخره (جرام 24)" },
  { key: "trade", label: "عروض التجارة" },
  { key: "debt", label: "ديون حالّة عليك" },
] as const;

export function ZakatPage() {
  const [v, setV] = useState({ gold: "", cash: "", goldG: "", trade: "", debt: "" });
  const [hawlComplete, setHawlComplete] = useState(false);
  const n = (value: string) => {
    const normalized = value.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 0xf))
      .replace(/٬|,/g, "").replace(/٫/g, ".").trim();
    if (!/^\d*(?:\.\d+)?$/.test(normalized)) return 0;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  };
  const nisab = 85 * n(v.gold), total = Math.max(0, n(v.cash) + n(v.goldG) * n(v.gold) + n(v.trade) - n(v.debt));
  const eligible = n(v.gold) > 0 && total >= nisab;
  const due = eligible && hawlComplete ? total * 0.025 : 0;
  const f = (x: number) => x.toLocaleString("ar", { maximumFractionDigits: 2 });
  return <main className="section-wrap section-page"><Crumb t="حاسبة الزكاة" /><Hero icon={Calculator} k="زكاة المال" t="قدّر زكاة مالك" p="أدخل سعر جرام الذهب اليوم بعملتك لتقدير النصاب على معيار ٨٥ جرامًا. تختلف بعض التفاصيل باختلاف نوع المال والحالة." /><QuranQuote surah={9} ayah={103} />
    <div className="pray-two"><div className="pray-card wide"><div className="form-grid">{ZAKAT_FIELDS.map(field => <label key={field.key}>{field.label}<input inputMode="decimal" placeholder={"placeholder" in field ? field.placeholder : undefined} value={v[field.key]} onChange={event => setV({ ...v, [field.key]: event.target.value })} /></label>)}</div></div>
      <div className="pray-card wide"><h3>النتيجة التقديرية</h3>{n(v.gold) === 0 ? <p>أدخل سعر الذهب أولًا.</p> : <><p className="big-num">{eligible ? hawlComplete ? f(due) : "—" : "لا يبلغ النصاب"}<small>{eligible ? hawlComplete ? " تقدير الزكاة (٢٫٥٪)" : " أكمل تأكيد الحول أولًا" : " صافي المال دون النصاب"}</small></p><p>النصاب التقديري: {f(nisab)} · صافي المال المدخل: {f(total)}</p><label className="hawl-confirm"><input type="checkbox" checked={hawlComplete} onChange={e => setHawlComplete(e.target.checked)} /> أؤكد مرور حول قمري على المال الذي تجب فيه الزكاة</label></>}</div></div>
    <p className="tool-note">هذه نتيجة تقريبية على مدخلاتك ولا تُغني عن فتوى موثوقة. تختلف أحكام الحول والديون والذهب المستعمل والأسهم والعقار؛ راجع دار الإفتاء أو عالمًا موثوقًا قبل إخراج الزكاة.</p>
    <ContentPage kind="learning" topic={{ category: "حاسبة الزكاة", heading: "دليل حساب زكاة المال" }} />
  </main>;
}
