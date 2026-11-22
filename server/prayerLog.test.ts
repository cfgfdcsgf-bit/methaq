import { afterEach, expect, it, vi } from "vitest";
import { logDate, prayerLogKey, readPrayerLog, readPrayerWeek, subscribePrayerLog, togglePrayerLog } from "../client/src/lib/prayerLog";

afterEach(() => vi.unstubAllGlobals());
it("preserves existing prayer records, separates days and updates subscribers", () => {
  const store = new Map<string, string>([["pr-2026-11-18", "[true,false,false,false,false]"]]);
  vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
  vi.stubGlobal("window", new EventTarget());
  const today = logDate({ y: 2026, m: 11, d: 19 });
  const week = readPrayerWeek(today);
  expect(week.map(day => day.key)).toEqual(["pr-2026-11-13", "pr-2026-11-14", "pr-2026-11-15", "pr-2026-11-16", "pr-2026-11-17", "pr-2026-11-18", "pr-2026-11-19"]);
  expect(week[5]?.done).toEqual([true, false, false, false, false]);
  const changed = vi.fn();
  const unsubscribe = subscribePrayerLog(changed);
  expect(togglePrayerLog(prayerLogKey(today), 4)).toBe(true);
  expect(changed).toHaveBeenCalledOnce();
  expect(readPrayerLog("pr-2026-11-19")).toEqual([false, false, false, false, true]);
  expect(readPrayerLog("pr-2026-11-18")).toEqual([true, false, false, false, false]);
  unsubscribe();
  togglePrayerLog(prayerLogKey(today), 4);
  expect(changed).toHaveBeenCalledOnce();
});
