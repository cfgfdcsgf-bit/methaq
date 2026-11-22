import { useState, useSyncExternalStore } from "react";
import { ArrowLeft, BookOpen, Check, Compass, GraduationCap, Sunrise } from "lucide-react";
import { ADHKAR_SESSIONS, routineStatus, sessionHref, type Session } from "@/components/AdhkarRoutine";
import KhatmaMeter from "@/components/KhatmaMeter";
import MotionLink from "@/components/MotionLink";
import { arNumber, dailyPortion, MUSHAF_PAGES, readPlan, wardUrl } from "@/lib/khatma";
import { PRAYERS } from "@shared/prayer";
import { prayerLogKey, readPrayerLog, subscribePrayerLog } from "@/lib/prayerLog";

export default function WorshipJourney({ day, now, session }: { day: number; now: Date; session: Session }) {
  const [selected, select] = useState(0);
  const plan = readPlan();
  const portion = plan && dailyPortion(plan);
  const ready = plan && portion && !portion.overdue && portion.remaining > 0;
  const fulfilled = !!plan && (plan.read === MUSHAF_PAGES || (!!portion && !portion.overdue && portion.remaining === 0));
  const prayers = useSyncExternalStore(subscribePrayerLog, () => readPrayerLog(prayerLogKey(day)).filter(Boolean).length);
  const dhikrStatus = routineStatus(session, now);
  const stations = [
    { title: "القرآن", icon: BookOpen, done: fulfilled, href: ready ? wardUrl(plan) : "/khatma",
      text: plan?.read === MUSHAF_PAGES ? "أتممت الختمة." : ready ? `باقي ${arNumber(portion.remaining)} صفحة من ورد اليوم.` : fulfilled ? "أتممت ورد اليوم." : portion?.overdue ? "يمكنك تمديد الخطة ومتابعة الورد من موضعك." : "اختر مدة ختمتك وحدّد وردًا يناسب يومك.",
      action: ready ? "تابع الورد" : plan ? "عرض خطة الختمة" : "ابدأ ختمتك" },
    { title: "الصلاة", icon: Compass, done: prayers === PRAYERS.length, href: "/prayer#salah-log",
      text: `سجّلت ${arNumber(prayers)} من ${arNumber(PRAYERS.length)} صلوات اليوم.`, action: "افتح سجلّ الصلاة" },
    { title: "الأذكار", icon: Sunrise, done: dhikrStatus === "done", href: sessionHref(session),
      text: dhikrStatus === "done" ? `أتممت جلسة ${ADHKAR_SESSIONS[session].label}.` : `${ADHKAR_SESSIONS[session].label} · ${dhikrStatus === "started" ? "تابع من مكانك" : "جاهزة للبدء"}`,
      action: dhikrStatus === "done" ? "راجع الأذكار" : dhikrStatus === "started" ? "تابع الجلسة" : "ابدأ الجلسة" },
    { title: "تعلّم", icon: GraduationCap, done: false, href: "/learning",
      text: "شاهد حلقة بودكاست أو اختر دورة في موضوع يهمّك.", action: "افتح التعلّم" },
  ];
  const active = stations[selected];
  return <section className="worship-journey" data-glass-light id="my-journey" aria-labelledby="journey-title">
    <div className="worship-journey-art" aria-hidden="true" />
    <header className="journey-heading">
      <div><h2 id="journey-title">رحلتي مع مِيثَاق</h2><p>اختر محطة وتابع من مكانك.</p></div>
      {plan && <KhatmaMeter pages={plan.read} />}
    </header>
    <ol className="journey-stations" aria-label="محطات الرحلة">
      {stations.map((station, index) => <li key={station.title}>
        <button type="button" aria-pressed={selected === index} onClick={() => select(index)}>
          <span className="journey-station-icon"><station.icon size={21} aria-hidden="true" /></span>
          <span>{station.title}</span>
          {station.done && <Check size={14} className="journey-station-check" aria-label="مكتملة" />}
        </button>
      </li>)}
    </ol>
    <div className="journey-detail" key={active.title}>
      <div role="status"><h3>{active.title}</h3><p>{active.text}</p></div>
      <MotionLink href={active.href} className="launch-cta">{active.action}<ArrowLeft size={17} aria-hidden="true" /></MotionLink>
    </div>
  </section>;
}
