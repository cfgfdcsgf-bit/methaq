import { useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Bell, Check, ChevronLeft, LayoutDashboard, LockKeyhole } from "lucide-react";
import { getCity, useNext } from "@/components/Tools";
import { ADHKAR_SESSIONS, routineStatus, sessionHref, suggestedSession, type Session } from "@/components/AdhkarRoutine";
import PrayerLogCard from "@/components/PrayerLogCard";
import WorshipJourney from "@/components/WorshipJourney";
import { arNumber } from "@/lib/khatma";
import { logDate } from "@/lib/prayerLog";
import GlassHeading from "@/components/GlassHeading";
import { readReminderPrefs, remindersEnabled } from "@/lib/reminders";

export default function PersonalDashboard() {
  const city = useMemo(getCity, []);
  const prayer = useNext(city);
  const prefs = readReminderPrefs();
  const reminderCount = Object.values(prefs.timed).filter(item => item.on).length + Object.values(prefs.prayers).filter(mode => mode !== "off").length + Number(prefs.ramadan);
  const reminders = remindersEnabled();
  const date = new Intl.DateTimeFormat("ar-EG", { dateStyle: "full", timeZone: city.tz }).format(prayer.now);
  return <main className="section-wrap companion-page personal-page">
    <GlassHeading icon={LayoutDashboard} label={date} title="متابعتي" description="ارجع لوردك، وتابع أذكارك وسجلّ صلاتك."
      action={<Link href="/" className="companion-link"><ChevronLeft size={16} />اليوم</Link>} />
    <WorshipJourney day={logDate(prayer.loc)} now={prayer.now} session={suggestedSession(Math.floor(prayer.loc.minutes / 60))} />
    <div className="personal-grid personal-journey-grid">
      <section className="companion-panel personal-dhikr" aria-labelledby="personal-dhikr-title">
        <div className="companion-panel-head"><span className="launch-tile-icon"><LayoutDashboard size={21} /></span><div><h2 id="personal-dhikr-title">أذكاري</h2><p>الصباح والمساء والنوم</p></div></div>
        <ul>{Object.entries(ADHKAR_SESSIONS).map(([key, item]) => {
          const session = key as Session;
          const status = routineStatus(session, prayer.now);
          return <li key={key}><Link href={sessionHref(session)}><item.icon size={17} aria-hidden="true" /><span>{item.label}</span><small>{status === "done" ? "مكتملة" : status === "started" ? "تابع" : "ابدأ"}</small>{status === "done" ? <Check size={15} /> : <ChevronLeft size={15} />}</Link></li>;
        })}</ul>
      </section>
      <PrayerLogCard today={logDate(prayer.loc)} />
      <section className="companion-panel personal-notices" aria-labelledby="personal-notices-title">
        <div className="companion-panel-head"><span className="launch-tile-icon"><Bell size={21} /></span><div><h2 id="personal-notices-title">تنبيهاتي</h2><p>{reminders ? reminderCount ? `${arNumber(reminderCount)} أنواع تذكير مفعّلة` : "هذا الجهاز جاهز للتنبيهات" : "التنبيهات متوقفة على هذا الجهاز"}</p></div></div>
        <Link className="companion-link" href="/settings">إعدادات التنبيهات <ArrowLeft size={16} /></Link>
      </section>
    </div>
    <p className="companion-private"><LockKeyhole size={14} /> يُحفظ تقدمك محليًا، وتُزامن العناصر المدعومة مع الحساب عند تسجيل الدخول والاتصال.</p>
  </main>;
}
