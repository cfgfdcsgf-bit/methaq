import { useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, CalendarDays, ChevronLeft, Compass, GraduationCap, Headphones, LayoutDashboard, MapPin, Moon } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import ReferenceHome from "@/components/ReferenceHome";
import MotionLink from "@/components/MotionLink";
import KhatmaMeter from "@/components/KhatmaMeter";
import { getCity, useNext } from "@/components/Tools";
import { ADHKAR_SESSIONS, routineStatus, sessionHref, suggestedSession } from "@/components/AdhkarRoutine";
import { arNumber, dailyPortion, MUSHAF_PAGES, readPlan, wardUrl } from "@/lib/khatma";
import { directoryHref } from "@/lib/sections";
import { hijriDate, PRAYERS, ramadan } from "@shared/prayer";
import "@/daily.css";

const padding = new Intl.NumberFormat("ar-EG", { minimumIntegerDigits: 2 });
function shortTime(hours: number) {
  if (!Number.isFinite(hours)) return "—";
  const minutes = Math.round(hours * 60) % 1440;
  return [padding.format(Math.floor(minutes / 60)), padding.format(minutes % 60)].join(":");
}
function savedPage() {
  try {
    const value = Number(localStorage.getItem("quranPage"));
    return Number.isInteger(value) && value >= 1 && value <= MUSHAF_PAGES ? value : null;
  } catch { return null; }
}

export default function DailyHome() {
  const { user } = useAuth();
  const city = useMemo(getCity, []);
  const prayer = useNext(city);
  const { now } = prayer;
  const isSeason = ramadan(now, city.tz, city.hijriOffset);
  const session = suggestedSession(Math.floor(prayer.loc.minutes / 60));
  const { label: dhikrLabel, icon: DhikrIcon } = ADHKAR_SESSIONS[session];
  const dhikrStatus = routineStatus(session, now);
  const dhikrDone = dhikrStatus === "done";
  const plan = readPlan();
  const portion = plan && dailyPortion(plan);
  const wardReady = Boolean(portion?.remaining && !portion.overdue);
  const focusWard = Boolean(plan && wardReady);
  const ward = plan && focusWard ? wardUrl(plan) : isSeason ? "/khatma?season=ramadan" : "/khatma";
  const page = savedPage();
  const readingLink = page ? `/quran?page=${page}` : "/quran";
  const wardTitle = !plan ? "ابدأ ختمتك" : plan.read === MUSHAF_PAGES ? "أتممت الختمة" : portion?.overdue ? "تابع ختمتك" : focusWard ? "واصل وردك" : "أتممت ورد اليوم";
  const date = new Intl.DateTimeFormat("ar-EG", { timeZone: city.tz, weekday: "long", day: "numeric", month: "long" }).format(now);
  const hijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { timeZone: city.tz, month: "long", day: "numeric", year: "numeric" }).format(hijriDate(now, city.tz, city.hijriOffset));
  const dailyHadith = trpc.content.dailyHadith.useQuery(undefined, { retry: false, staleTime: 60_000 }).data;
  const nextIsToday = prayer.events.some(event => event.at === prayer.next?.at);
  const nextTime = prayer.next ? new Intl.DateTimeFormat("ar-EG", { timeZone: city.tz, hour: "numeric", minute: "2-digit" }).format(prayer.next.at) : null;
  const firstName = user?.name?.trim().split(/\s+/)[0];
  return <main className="reference-main-landmark">
    <ReferenceHome readingHref={readingLink} wardHref={ward} ready={focusWard}>
      <div className="reference-daily-heading">
        <h2>{firstName ? `أهلًا بك، ${firstName}` : "يومك مع ميثاق"}</h2>
        <p className="launch-date"><CalendarDays size={15} aria-hidden="true" />{date}<span>·</span>{hijri}</p>
      </div>
    {isSeason && <section className="launch-season">
      <Moon size={22} aria-hidden="true" /><div><h2>رمضان</h2><p>الفجر <b dir="ltr">{shortTime(prayer.times.fajr)}</b><span>·</span>المغرب <b dir="ltr">{shortTime(prayer.times.maghrib)}</b></p></div>
      <Link href="/ramadan">إمساكية رمضان <ArrowLeft size={17} /></Link>
    </section>}
    <section className="launch-dashboard release-dashboard today-panel" aria-label="وردك وصلاتك وأذكارك اليوم">
        <section className="launch-focus release-ward scene-ward" data-glass-light aria-labelledby="launch-focus-heading">
          <div className="release-book-art" aria-hidden="true" />
          <div className="launch-focus-content">
            <p className="launch-kicker"><BookOpen size={17} />{isSeason ? "ختمة رمضان" : "ختمتي"}</p>
            <h2 id="launch-focus-heading">{wardTitle}</h2>
            <p className="launch-focus-copy">{focusWard && portion ? `من الصفحة ${arNumber(portion.first)} إلى ${arNumber(portion.last)} في ورد اليوم.` : portion?.overdue && plan?.read !== MUSHAF_PAGES ? "مدّد الخطة وتابع من موضعك." : plan ? `${arNumber(plan.read)} من ${arNumber(MUSHAF_PAGES)} صفحة مقروءة` : "اختر مدة تناسبك واقرأ وردك من المصحف."}</p>
            <div className="launch-focus-actions">
              <MotionLink className="launch-cta" href={ward}>{focusWard ? "متابعة القراءة" : plan ? "عرض الخطة" : "اختر مدة الختمة"} <ArrowLeft size={18} /></MotionLink>
              {focusWard && <MotionLink className="scene-secondary-action" href="/khatma"><CalendarDays size={16} /> خطّة الختمة</MotionLink>}
            </div>
          </div>
          {plan && <KhatmaMeter pages={plan.read} />}
        </section>
      <section className="launch-prayer release-prayer scene-prayer" data-glass-light aria-labelledby="launch-prayer-heading">
        <div className="launch-prayer-top"><p>الصلاة القادمة</p><Link href="/prayer" aria-label={`المدينة الحالية ${city.name}، تغيير المدينة`}><MapPin size={15} />{city.name}</Link></div>
        <div className="launch-prayer-now"><h2 id="launch-prayer-heading">{prayer.nextName}</h2>{nextTime && <span>{nextTime}{!nextIsToday && " غدًا"}</span>}</div>
        <p className="launch-countdown" dir="ltr" aria-label="الوقت المتبقي للصلاة">{prayer.left}</p>
        <p className="launch-prayer-list-label">مواقيت اليوم</p>
        <ul className="launch-prayer-list" aria-label="مواقيت اليوم">{PRAYERS.map(([key, label]) => <li key={key} className={key === prayer.next?.prayer && nextIsToday ? "current" : undefined}><span>{label}</span><b dir="ltr">{shortTime(prayer.times[key])}</b></li>)}</ul>
        <div className="launch-prayer-actions"><MotionLink href="/prayer" motion="prayer">المواقيت <ChevronLeft size={16} /></MotionLink><Link href="/prayer#qibla">القبلة <Compass size={16} /></Link></div>
      </section>
      <section className="release-dhikr" data-glass-light aria-labelledby="release-dhikr-title">
        <div className="release-dhikr-intro"><span className="release-dhikr-icon"><DhikrIcon size={24} /></span><div><h2 id="release-dhikr-title">{dhikrLabel}</h2><p>{dhikrDone ? "الجلسة مكتملة" : dhikrStatus === "started" ? "متابعة من آخر ذكر" : "جلسة الذكر المناسبة للوقت"}</p></div></div>
        <MotionLink href={sessionHref(session)} className="companion-link">{dhikrDone ? "راجع" : dhikrStatus === "started" ? "تابع" : "ابدأ"}<ChevronLeft size={16} /></MotionLink>
      </section>
    </section>
    <div className="release-secondary">
      <section className="release-dhikr release-personal" data-glass-light aria-labelledby="release-personal-title">
        <div className="release-dhikr-intro"><span className="release-dhikr-icon"><LayoutDashboard size={22} /></span><div><h2 id="release-personal-title">متابعتي</h2><p>سجلّ الصلاة وتقدّم القراءة</p></div></div>
        <MotionLink href="/my-day" className="companion-link">افتح اللوحة <ChevronLeft size={16} /></MotionLink>
      </section>
      {dailyHadith && <section className="release-dhikr daily-hadith" aria-labelledby="daily-hadith-title">
        <div className="release-dhikr-intro"><div><h2 id="daily-hadith-title">حديث اليوم</h2><p>{dailyHadith.title}</p></div></div>
        <MotionLink href={`/sunnah?open=${dailyHadith.id}`} className="companion-link">اقرأ الحديث <ChevronLeft size={16} /></MotionLink>
      </section>}
    </div>
    <section className="home-learning" aria-labelledby="home-learning-title">
      <h2 id="home-learning-title">تعلّم</h2>
      <div>
        <MotionLink href="/learning?view=podcasts" className="launch-tile study-scene" data-art="courtyard" data-glass-light>
          <span className="launch-tile-icon"><Headphones size={21} aria-hidden="true" /></span>
          <strong>البودكاست الديني</strong><ArrowLeft size={17} aria-hidden="true" />
        </MotionLink>
        <MotionLink href="/learning?view=courses" className="launch-tile study-scene" data-art="arcade" data-glass-light>
          <span className="launch-tile-icon"><GraduationCap size={21} aria-hidden="true" /></span>
          <strong>الدورات الدينية</strong><ArrowLeft size={17} aria-hidden="true" />
        </MotionLink>
      </div>
    </section>
    <div className="launch-home-links"><Link href={directoryHref("today")}>أدوات ومواسم <ArrowLeft size={16} /></Link><Link href="/rafiq">اسأل رفيق <ArrowLeft size={16} /></Link></div>
    </ReferenceHome>
  </main>;
}
