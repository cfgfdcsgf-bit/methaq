import { PRAYERS } from "@shared/prayer";
const changeEvent = "meethaq-prayer-log-change";

export function logDate(date: { y: number; m: number; d: number }) {
  return Date.UTC(date.y, date.m - 1, date.d);
}
export function prayerLogKey(day: number) {
  return "pr-" + new Date(day).toISOString().slice(0, 10);
}
function rawLog(key: string) {
  try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
}
export function readPrayerLog(key: string) {
  let saved: unknown;
  try { saved = JSON.parse(rawLog(key)); } catch {}
  return PRAYERS.map((_, index) => Array.isArray(saved) && saved[index] === true);
}
export function togglePrayerLog(key: string, index: number) {
  const next = readPrayerLog(key);
  next[index] = !next[index];
  try {
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event(changeEvent));
    return true;
  } catch { return false; }
}
export function subscribePrayerLog(update: () => void) {
  window.addEventListener(changeEvent, update);
  window.addEventListener("storage", update);
  return () => {
    window.removeEventListener(changeEvent, update);
    window.removeEventListener("storage", update);
  };
}
export function readPrayerWeek(today: number) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = today - (6 - index) * 86_400_000;
    const key = prayerLogKey(day);
    return { day, key, done: readPrayerLog(key) };
  });
}
export function prayerWeekSnapshot(today: number) {
  return readPrayerWeek(today).map(entry => entry.done.map(value => value ? "1" : "0").join("")).join("-");
}
