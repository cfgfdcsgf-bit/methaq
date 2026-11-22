export const METHODS = {
  egypt: { label: "الهيئة المصرية العامة للمساحة", fajr: 19.5, isha: 17.5 },
  mwl: { label: "رابطة العالم الإسلامي", fajr: 18, isha: 17 },
  isna: { label: "الجمعية الإسلامية لأمريكا الشمالية", fajr: 15, isha: 15 },
  makkah: { label: "أم القرى", fajr: 18.5, isha: 0 },
};
export const PRAYERS = [["fajr", "الفجر"], ["dhuhr", "الظهر"], ["asr", "العصر"], ["maghrib", "المغرب"], ["isha", "العشاء"]] as const;
export type PrayerKey = (typeof PRAYERS)[number][0] | "sunrise";
export type PrayerCity = {
  lat: number; lng: number; tz?: string; method?: keyof typeof METHODS;
  hanafi?: boolean; offsets?: Partial<Record<PrayerKey, number>>;
  hijriOffset?: -1 | 0 | 1;
};
const minute = 60_000;
const radians = Math.PI / 180;
const wrap = (n: number, cycle: number) => (n % cycle + cycle) % cycle;
const formatters = new Map<string, Intl.DateTimeFormat>();
const hijriFormatters = new Map<string, Intl.DateTimeFormat>();
export function cityDate(tz: string | undefined, now: Date) {
  const key = tz ?? "";
  if (!formatters.has(key)) formatters.set(key, new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23",
  }));
  const parts = Object.fromEntries(formatters.get(key)!.formatToParts(now).map(part => [part.type, Number(part.value)]));
  return { y: parts.year, m: parts.month, d: parts.day, minutes: 60 * parts.hour + parts.minute };
}
type CityDate = Pick<ReturnType<typeof cityDate>, "y" | "m" | "d">;
export function localInstant(tz: string | undefined, date: CityDate, minutes: number) {
  const wall = Date.UTC(date.y, date.m - 1, date.d) + Math.round(minutes) * minute;
  let instant = wall;
  for (let attempt = 0; attempt < 3; attempt++) {
    const local = cityDate(tz, new Date(instant));
    const represented = Date.UTC(local.y, local.m - 1, local.d) + local.minutes * minute;
    if (represented === wall) return instant;
    instant += wall - represented;
  }
  return instant;
}
export function hijriDate(now: Date, tz?: string, adjustment: number = 0) {
  if (adjustment !== -1 && adjustment !== 1) return now;
  const date = cityDate(tz, now);
  return new Date(localInstant(tz, { ...date, d: date.d + adjustment }, 720));
}

export function ramadan(now: Date, tz?: string, adjustment = 0) {
  const key = tz ?? "";
  if (!hijriFormatters.has(key)) hijriFormatters.set(key, new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { timeZone: tz, month: "numeric" }));
  return hijriFormatters.get(key)!.formatToParts(hijriDate(now, tz, adjustment)).some(part => part.type === "month" && part.value === "9");
}
export function calculationMethod(city: PrayerCity): keyof typeof METHODS {
  if (city.method) return city.method;
  if (!city.tz || city.tz === "Africa/Cairo") return "egypt";
  if (city.tz === "Asia/Riyadh") return "makkah";
  return city.tz.startsWith("America/") ? "isna" : "mwl";
}
export function prayerTimes(city: PrayerCity, now = new Date()) {
  const loc = cityDate(city.tz, now);
  const day = Date.UTC(loc.y, loc.m - 1, loc.d);
  const noon = localInstant(city.tz, loc, 720);
  const offset = (day + 720 * minute - noon) / 3_600_000;
  const days = day / 86_400_000 - 10957.5 - city.lng / 360;
  const anomaly = wrap(357.529 + 0.98560028 * days, 360);
  const longitude = wrap(280.459 + 0.98564736 * days, 360);
  const apparent = longitude + 1.915 * Math.sin(anomaly * radians) + 0.02 * Math.sin(2 * anomaly * radians);
  const tilt = 23.439 - 0.00000036 * days;
  const ascension = Math.atan2(Math.cos(tilt * radians) * Math.sin(apparent * radians), Math.cos(apparent * radians)) / radians / 15;
  const declination = Math.asin(Math.sin(tilt * radians) * Math.sin(apparent * radians));
  const midday = 12 - (wrap(longitude / 15 - ascension + 12, 24) - 12);
  const latitude = city.lat * radians;
  const hourAngle = (angle: number) => Math.acos((-Math.sin(angle * radians) - Math.sin(declination) * Math.sin(latitude)) /
    (Math.cos(declination) * Math.cos(latitude))) / radians / 15;
  const asrAngle = -Math.atan(1 / ((city.hanafi ? 2 : 1) + Math.tan(Math.abs(latitude - declination)))) / radians;
  const sunset = midday + hourAngle(0.833);
  const key = calculationMethod(city);
  const method = METHODS[key];
  const values: Record<PrayerKey, number> = {
    fajr: midday - hourAngle(method.fajr), sunrise: midday - hourAngle(0.833), dhuhr: midday,
    asr: midday + hourAngle(asrAngle), maghrib: sunset,
    isha: key === "makkah" ? sunset + (ramadan(now, city.tz, city.hijriOffset) ? 2 : 1.5) : midday + hourAngle(method.isha),
  };
  const times = Object.fromEntries(Object.entries(values).map(([name, time]) => [
    name, wrap(Math.round((time + offset - city.lng / 15) * 60) + (city.offsets?.[name as PrayerKey] ?? 0), 1440) / 60,
  ])) as Record<PrayerKey, number>;
  const events = PRAYERS.flatMap(([prayer, label]) => Number.isFinite(times[prayer])
    ? [{ prayer, label, at: localInstant(city.tz, loc, times[prayer] * 60) }] : []).sort((a, b) => a.at - b.at);
  return { times, events, loc };
}

export function ramadanDaysLeft(tz: string | undefined, now = new Date(), adjustment = 0) {
  const date = cityDate(tz, now);
  let days = 0;
  while (days < 30 && ramadan(new Date(localInstant(tz, { ...date, d: date.d + days }, 720)), tz, adjustment)) days++;
  return days || 30;
}
