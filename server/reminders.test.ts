import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { cityDate, localInstant, prayerTimes } from "../shared/prayer";
import { DEFAULT_REMINDERS, scheduleReminders } from "../shared/reminders";
import { dailyPortion, planKhatma, readPlan, recordPages, wardUrl } from "../client/src/lib/khatma";

const cairo = { lat: 30.0444, lng: 31.2357, tz: "Africa/Cairo" };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("prayer and reminders", () => {
  it("matches the Egyptian Survey Authority's published Cairo times for 2026-11-19", () => {
    // https://www.esa.gov.eg/praytimes.aspx
    const computed = prayerTimes(cairo, new Date("2026-11-19T09:00:00Z"));
    expect(Object.values(computed.times).map(hours => Math.round(hours * 60))).toEqual([293, 383, 700, 877, 1017, 1098]);
    expect(computed.events.find(event => event.prayer === "maghrib")?.at).toEqual(Date.parse("2026-11-19T14:57:00Z"));
  });

  it("schedules custom times in the selected city's zone, including daylight saving", () => {
    const prefs = structuredClone(DEFAULT_REMINDERS);
    prefs.timed.morning = { on: true, time: "07:10" };
    prefs.prayers.maghrib = "adhan";
    const newYork = { lat: 40.71, lng: -74.01, tz: "America/New_York" };
    const now = new Date("2026-07-20T15:00:00Z");
    const reminders = scheduleReminders(prefs, newYork, now);
    expect(reminders).toHaveLength(2);
    expect(reminders.find(item => item.key === "morning")).toMatchObject({ at: Date.parse("2026-07-20T11:10:00Z"), href: "/adhkar?session=morning" });
    expect(reminders.find(item => item.key === "maghrib")).toMatchObject({ silent: true, href: "/prayer?adhan=1" });
    const winter = cityDate(newYork.tz, new Date("2026-11-19T12:00:00Z"));
    expect(localInstant(newYork.tz, winter, 430)).toEqual(Date.parse("2026-11-19T12:10:00Z"));
  });

  it("only schedules seasonal notifications during Ramadan", () => {
    const prefs = { ...DEFAULT_REMINDERS, ramadan: true };
    const february = new Date("2026-02-25T12:00:00Z");
    expect(scheduleReminders(prefs, cairo, february).map(item => item.key)).toEqual(["iftar", "ramadan-fajr"]);
    expect(scheduleReminders(prefs, cairo, new Date("2026-11-19T12:00:00Z"))).toEqual([]);
  });
});

describe("daily Quran portion", () => {
  function useStore(seed: Record<string, string> = {}) {
    const store = new Map(Object.entries(seed));
    vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) });
  }
  it("records a day's portion only once and redistributes it after a missed day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 19, 10));
    useStore();
    const plan = planKhatma(30);
    expect(wardUrl(plan)).toBe("/quran?ward=1&page=1");
    expect(dailyPortion(plan).remaining).toBe(21);
    expect(recordPages("today")?.read).toBe(21);
    expect(recordPages("today")?.read).toBe(21);
    vi.setSystemTime(new Date(2026, 10, 21, 10));
    expect(dailyPortion(readPlan()!)).toMatchObject({ first: 22, last: 42, remaining: 21 });
    vi.setSystemTime(new Date(2026, 10, 24, 10));
    expect(dailyPortion(readPlan()!)).toMatchObject({ first: 22, last: 45, remaining: 24 });
  });
  it("keeps legacy pages and keeps progress after extending the plan", () => {
    useStore({ "kh-days": "30", "kh-read": "123" });
    const current = readPlan()!;
    expect(current.read).toBe(123);
    const adjusted = planKhatma(30);
    expect(adjusted.read).toBe(123);
    expect(dailyPortion(adjusted).first).toBe(124);
  });
});

it("displays a push and opens the correct adhkar session from its notification", async () => {
  const events = new Map<string, (event: Record<string, unknown>) => void>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  runInNewContext(readFileSync("client/public/service-worker.js", "utf8"), {
    URL,
    self: {
      location: { origin: "https://meethaq.example" },
      registration: { showNotification },
      clients: { matchAll: async () => [], openWindow },
      addEventListener: (name: string, listener: (event: Record<string, unknown>) => void) => events.set(name, listener),
    },
  });
  const waitUntil = vi.fn();
  const close = vi.fn();
  const href = "/adhkar?session=evening";
  events.get("push")!({ waitUntil, data: { json: () => ({ key: "evening", title: "حان وقت أذكار المساء", href }) } });
  expect(showNotification).toHaveBeenCalledWith("حان وقت أذكار المساء", expect.objectContaining({ data: { href } }));
  events.get("notificationclick")!({ waitUntil, notification: { close, data: { href } } });
  await waitUntil.mock.lastCall?.[0];
  expect(close).toHaveBeenCalledOnce();
  expect(openWindow).toHaveBeenCalledWith("https://meethaq.example/adhkar?session=evening");
});
