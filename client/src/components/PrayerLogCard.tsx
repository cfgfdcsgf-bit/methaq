import { memo, useMemo, useState, useSyncExternalStore } from "react";
import { CalendarDays, Check, Circle, LockKeyhole } from "lucide-react";
import { PRAYERS } from "@shared/prayer";
import { arNumber } from "@/lib/khatma";
import { prayerLogKey, prayerWeekSnapshot, readPrayerWeek, subscribePrayerLog, togglePrayerLog } from "@/lib/prayerLog";

const weekday = new Intl.DateTimeFormat("ar-EG", { weekday: "short", timeZone: "UTC" });
const dayNumber = new Intl.DateTimeFormat("ar-EG", { day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("ar-EG", { dateStyle: "full", timeZone: "UTC" });

export default memo(function PrayerLogCard({ today }: { today: number }) {
  const todayKey = prayerLogKey(today);
  const [selected, setSelected] = useState(todayKey);
  const [error, setError] = useState(false);
  const snapshot = useSyncExternalStore(subscribePrayerLog, () => prayerWeekSnapshot(today));
  const week = useMemo(() => readPrayerWeek(today), [today, snapshot]);
  const active = week.find(entry => entry.key === selected) ?? week[week.length - 1];
  const total = active.done.filter(Boolean).length;
  return <section className="companion-panel prayer-log" id="salah-log" aria-labelledby="prayer-log-title">
    <header className="companion-panel-head">
      <span className="launch-tile-icon"><CalendarDays size={21} aria-hidden="true" /></span>
      <div><h2 id="prayer-log-title">سجلّ صلاتي</h2><p>{active.key === todayKey ? "اليوم" : fullDate.format(active.day)}</p></div>
      <span className="companion-count" aria-label={`الصلوات المسجّلة ${arNumber(total)} من ${arNumber(PRAYERS.length)}`}>{arNumber(total)} <span aria-hidden="true">/</span> {arNumber(PRAYERS.length)}</span>
    </header>
    <div className="prayer-week" aria-label="آخر سبعة أيام" role="group">
      {week.map(entry => <button type="button" key={entry.key} aria-pressed={entry.key === active.key} aria-description={fullDate.format(entry.day)} onClick={() => { setSelected(entry.key); setError(false); }}>
        <span>{entry.key === todayKey ? "اليوم" : weekday.format(entry.day)}</span><strong>{dayNumber.format(entry.day)}</strong><i aria-hidden="true" data-count={entry.done.filter(Boolean).length} />
      </button>)}
    </div>
    <div className="prayer-log-actions" key={active.key} aria-label="الصلوات المسجّلة">
      {PRAYERS.map(([key, label], index) => <button key={key} type="button" aria-pressed={active.done[index]} onClick={() => setError(!togglePrayerLog(active.key, index))}>
        {active.done[index] ? <Check size={17} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}{label}
      </button>)}
    </div>
    <p className="companion-private"><LockKeyhole size={14} aria-hidden="true" />{error ? "تعذّر حفظ السجل على هذا الجهاز." : "السجل محفوظ محليًا، ويُزامن مع الحساب عند تسجيل الدخول والاتصال."}</p>
    <span className="sr-only" role="status">{arNumber(total)} من {arNumber(PRAYERS.length)} صلوات مسجّلة</span>
  </section>;
});
