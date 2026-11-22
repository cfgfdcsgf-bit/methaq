import { useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Bell, BookOpen, GraduationCap, Headphones, Moon } from "lucide-react";
import { getCity } from "@/components/Tools";
import { cityDate, localInstant, prayerTimes, ramadan } from "@shared/prayer";
import "@/ramadan.css";

const fmt = (hours: number) => {
  if (!Number.isFinite(hours)) return "—";
  const fromMidnight = Math.round(hours * 60);
  return [Math.floor(fromMidnight / 60), fromMidnight % 60].map(number => number.toLocaleString("ar-EG", { minimumIntegerDigits: 2 })).join(":");
};
export default function RamadanDashboard() {
  const city = useMemo(getCity, []);
  const now = new Date();
  const { y, m, d } = cityDate(city.tz, now);
  const season = useMemo(() => {
    const dateAt = (offset: number) => new Date(localInstant(city.tz, { y, m, d: d + offset }, 720));
    let start = 0;
    const inSeason = ramadan(dateAt(0), city.tz, city.hijriOffset);
    if (inSeason) {
      while (start > -30 && ramadan(dateAt(start - 1), city.tz, city.hijriOffset)) start--;
    } else {
      while (start < 370 && !ramadan(dateAt(start), city.tz, city.hijriOffset)) start++;
    }
    const dateLabel = new Intl.DateTimeFormat("ar-EG", { timeZone: city.tz, weekday: "short", day: "numeric", month: "short" });
    const rows = [];
    for (let index = 0; index < 30; index++) {
      const date = dateAt(start + index);
      if (!ramadan(date, city.tz, city.hijriOffset)) break;
      const { fajr, maghrib } = prayerTimes(city, date).times;
      rows.push({ day: index + 1, today: start + index === 0, label: dateLabel.format(date), fajr, maghrib });
    }
    return { rows, inSeason };
  }, [city, y, m, d]);
  return <section className="ramadan-dashboard ramadan-hub" aria-labelledby="ramadan-hub-title">
    <div className="daily-section-head"><h2 id="ramadan-hub-title"><Moon size={21} aria-hidden="true" /> الاستعداد لرمضان</h2></div>
    <div className="ramadan-resources">
      <Link href="/khatma?season=ramadan"><BookOpen size={21} aria-hidden="true" /><span><b>خطّة ختمة رمضان</b><small>حدّد وردك واقرأ من المصحف.</small></span><ArrowLeft size={17} aria-hidden="true" /></Link>
      <Link href="/learning?view=courses&topic=ramadan"><GraduationCap size={21} aria-hidden="true" /><span><b>تعلّم أحكام الصيام</b><small>دورات في الصيام والقيام والعشر الأواخر.</small></span><ArrowLeft size={17} aria-hidden="true" /></Link>
      <Link href="/learning?view=podcasts&topic=ramadan"><Headphones size={21} aria-hidden="true" /><span><b>حلقات عن رمضان</b><small>استمع عن الاستعداد للشهر ومواصلة العبادة.</small></span><ArrowLeft size={17} aria-hidden="true" /></Link>
      <Link href="/settings"><Bell size={21} aria-hidden="true" /><span><b>اضبط التنبيهات</b><small>خصّص التذكيرات من إعدادات جهازك.</small></span><ArrowLeft size={17} aria-hidden="true" /></Link>
    </div>
    <details className="ramadan-calendar">
      <summary>إمساكية {city.name}{season.inSeason ? "" : " · رمضان القادم"}</summary>
      <p className="tool-note">مواقيت تقديرية وفق حساب مدينتك. اعتمد إعلان بلدك لدخول الشهر، وراجع تقويم مسجدك للمواقيت.</p>
      <Link className="ramadan-city-link" href="/prayer">تغيير المدينة <ArrowLeft size={15} aria-hidden="true" /></Link>
      {season.rows.length ? <div className="ramadan-times"><table>
      <thead><tr><th scope="col">اليوم</th><th scope="col">الفجر</th><th scope="col">المغرب</th></tr></thead>
      <tbody>{season.rows.map(day => <tr key={day.day} aria-current={day.today ? "date" : undefined}>
        <th scope="row">{day.day.toLocaleString("ar-EG")} · {day.label}{day.today && " · اليوم"}</th>
        <td dir="ltr">{fmt(day.fajr)}</td><td dir="ltr">{fmt(day.maghrib)}</td>
      </tr>)}</tbody>
      </table></div> : <p>تعذّر حساب الإمساكية لهذه المدينة.</p>}
    </details>
  </section>;
}
