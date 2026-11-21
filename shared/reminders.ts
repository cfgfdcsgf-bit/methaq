import { cityDate, localInstant, PRAYERS, prayerTimes, ramadan, type PrayerCity } from "./prayer";

export const TIMED_REMINDERS = [
  { key: "morning", label: "أذكار الصباح", title: "حان وقت أذكار الصباح", time: "07:00", href: "/adhkar?session=morning" },
  { key: "evening", label: "أذكار المساء", title: "حان وقت أذكار المساء", time: "17:00", href: "/adhkar?session=evening" },
  { key: "sleep", label: "أذكار النوم", title: "تذكير بأذكار النوم", time: "22:00", href: "/adhkar?session=sleep" },
  { key: "ward", label: "ورد القرآن", title: "موعد ورد القرآن", time: "20:00", href: "/khatma" },
] as const;
type Prayer = (typeof PRAYERS)[number][0];
type TimedKey = (typeof TIMED_REMINDERS)[number]["key"];
export type ReminderPrefs = {
  prayers: Record<Prayer, "off" | "silent" | "sound" | "adhan">;
  timed: Record<TimedKey, { on: boolean; time: string }>;
  ramadan: boolean;
};
export const DEFAULT_REMINDERS: ReminderPrefs = {
  prayers: { fajr: "off", dhuhr: "off", asr: "off", maghrib: "off", isha: "off" },
  timed: { morning: { on: false, time: "07:00" }, evening: { on: false, time: "17:00" }, sleep: { on: false, time: "22:00" }, ward: { on: false, time: "20:00" } },
  ramadan: false,
};
export const TEST_REMINDER = { key: "test", title: "تنبيه مِيثَاق التجريبي", body: "اضغط للتحقق من أن التنبيهات تفتح الإعدادات.", href: "/settings", silent: false };
type Reminder = { key: string; title: string; body: string; href: string; silent: boolean; at: number };

export function scheduleReminders(prefs: ReminderPrefs, city: PrayerCity, now: Date): Reminder[] {
  const date = cityDate(city.tz, now);
  const { events } = prayerTimes(city, now);
  const reminders: Reminder[] = [];
  for (const event of events) {
    const mode = prefs.prayers[event.prayer];
    if (mode === "off") continue;
    reminders.push({ key: event.prayer, at: event.at, title: `حان وقت صلاة ${event.label}`, body: mode === "adhan" ? "اضغط للاستماع إلى الأذان." : "اضغط لعرض المواقيت.", href: mode === "adhan" ? "/prayer?adhan=1" : "/prayer", silent: mode === "silent" || mode === "adhan" });
  }
  for (const item of TIMED_REMINDERS) {
    const setting = prefs.timed[item.key];
    if (!setting.on) continue;
    const [hours, minutes] = setting.time.split(":").map(Number);
    reminders.push({ key: item.key, at: localInstant(city.tz, date, hours * 60 + minutes), title: item.title, body: "افتح مِيثَاق للمتابعة.", href: item.href, silent: false });
  }
  if (prefs.ramadan && ramadan(now, city.tz, city.hijriOffset)) {
    const maghrib = events.find(event => event.prayer === "maghrib");
    const fajr = events.find(event => event.prayer === "fajr");
    if (maghrib) reminders.push({ key: "iftar", at: maghrib.at, title: "وقت المغرب", body: "افتح مِيثَاق لمواقيت رمضان.", href: "/ramadan", silent: false });
    if (fajr) reminders.push({ key: "ramadan-fajr", at: fajr.at - 15 * 60_000, title: "بقي ربع ساعة على الفجر", body: "راجع مواقيت رمضان لمدينتك.", href: "/ramadan", silent: false });
  }
  return reminders;
}
