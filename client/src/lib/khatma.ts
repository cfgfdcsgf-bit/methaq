import { toast } from "sonner";

export const MUSHAF_PAGES = 604;
const DAY_MS = 86_400_000;
const ar = new Intl.NumberFormat("ar-EG", { useGrouping: false });
export const arNumber = (number: number) => ar.format(number);

export function localDay(date = new Date()) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

type Plan = { days: number; read: number; start: number; end: number; day: number; baseline: number };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function readPlan(): Plan | null {
  const day = localDay();
  try {
    const value = JSON.parse(localStorage.getItem("meethaq-khatma-v2") ?? "null");
    if (value && ["days", "read", "start", "end", "day", "baseline"].every(key => Number.isSafeInteger(value[key]))) {
      const read = clamp(value.read, 0, MUSHAF_PAGES);
      return { ...value, read, day, baseline: value.day === day ? clamp(value.baseline, 0, read) : read };
    }
    const storedDays = localStorage.getItem("kh-days");
    const storedRead = localStorage.getItem("kh-read");
    if (storedDays === null && storedRead === null) return null;
    const days = clamp(Number.parseInt(storedDays ?? "30", 10) || 30, 1, 90);
    const read = clamp(Number.parseInt(storedRead ?? "0", 10) || 0, 0, MUSHAF_PAGES);
    const remainingDays = Math.max(1, Math.ceil((MUSHAF_PAGES - read) / Math.ceil(MUSHAF_PAGES / days)));
    return { days, read, day, baseline: read, start: day, end: day + remainingDays - 1 };
  } catch { return null; }
}

function save(plan: Plan) {
  try { localStorage.setItem("meethaq-khatma-v2", JSON.stringify(plan)); }
  catch {
    toast.error("تعذّر حفظ الختمة على هذا الجهاز.");
  }
  return plan;
}

export function planKhatma(days: number, reset = false) {
  const current = reset ? null : readPlan();
  const day = localDay();
  const read = current?.read ?? 0;
  return save({ days, read, start: day, end: day + days - 1, day, baseline: current?.baseline ?? read });
}

export function dailyPortion(plan: Plan) {
  const days = Math.max(1, plan.end - plan.day + 1);
  const goal = Math.ceil((MUSHAF_PAGES - plan.baseline) / days);
  const readToday = plan.read - plan.baseline;
  return { goal, readToday, remaining: Math.max(0, goal - readToday), first: plan.read + 1, last: plan.baseline + goal, overdue: plan.day > plan.end };
}

export function recordPages(delta: number | "today") {
  const plan = readPlan();
  if (!plan) return null;
  const read = clamp(plan.read + (delta === "today" ? dailyPortion(plan).remaining : delta), 0, MUSHAF_PAGES);
  return save({ ...plan, read, baseline: Math.min(plan.baseline, read) });
}

const cursorKey = "meethaq-ward-cursor";
export function saveWardCursor(page: number) {
  const plan = readPlan();
  if (!plan) return;
  const { first, last, remaining, overdue } = dailyPortion(plan);
  if (remaining && !overdue && page >= first && page <= last) {
    try { localStorage.setItem(cursorKey, JSON.stringify({ day: plan.day, baseline: plan.baseline, page })); } catch {}
  }
}

export function wardUrl(plan: Plan) {
  const { first, last } = dailyPortion(plan);
  let page = first;
  try {
    const saved = JSON.parse(localStorage.getItem(cursorKey) ?? "null");
    if (saved?.day === plan.day && saved.baseline === plan.baseline && Number.isInteger(saved.page) && saved.page >= first && saved.page <= last) page = saved.page;
  } catch {}
  return `/quran?ward=1&page=${page}`;
}
