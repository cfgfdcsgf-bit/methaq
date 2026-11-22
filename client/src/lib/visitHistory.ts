import { useEffect, useState } from "react";
import { localDay } from "@/lib/khatma";

const storageKey = "visitDays";
const dayMs = 86_400_000;
const dayKey = (day: number) => new Date(day).toISOString().slice(0, 10);

function readVisits(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) : [];
  } catch {
    return [];
  }
}

export function useVisitHistory() {
  const [visits, setVisits] = useState(readVisits);
  const today = localDay() * dayMs;
  useEffect(() => {
    const saved = readVisits();
    const key = dayKey(today);
    if (saved.includes(key)) return;
    const next = [...saved, key];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
    setVisits(next);
  }, [today]);
  const recorded = new Set(visits);
  let streak = 0;
  while (recorded.has(dayKey(today - streak * dayMs))) streak += 1;
  return {
    streak,
    days: recorded.size,
    week: Array.from({ length: 7 }, (_, index) => {
      const date = today - index * dayMs;
      return { date, seen: recorded.has(dayKey(date)) };
    }),
  };
}
