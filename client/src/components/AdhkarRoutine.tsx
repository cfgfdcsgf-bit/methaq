import { useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowLeft, Check, Heart, Moon, RotateCcw, Sun, Sunrise } from "lucide-react";
import { arNumber } from "@/lib/khatma";

const forgiveness = {
  id: "forgiveness", label: "سيد الاستغفار", repetitions: 1, source: "صحيح البخاري (٦٣٠٦)",
  text: "اللَّهُمَّ أَنْتَ رَبِّي، لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ لَكَ بِذَنْبِي، فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ.",
};
const safety = {
  id: "safety", label: "بسم الله الذي لا يضرّ مع اسمه شيء", repetitions: 3, source: "سنن أبي داود (٥٠٨٨)",
  text: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ.",
};
const sleep = {
  id: "sleep", label: "عند النوم", repetitions: 1, source: "صحيح البخاري (٦٣٢٤)",
  text: "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا.",
};
const bedside = {
  id: "bedside", label: "ذكر عند الاضطجاع", repetitions: 1, source: "صحيح البخاري (٦٣٢٠)",
  text: "بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، إِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ.",
};
export const ADHKAR_SESSIONS = {
  morning: { label: "أذكار الصباح", icon: Sunrise, entries: [forgiveness, safety] },
  evening: { label: "أذكار المساء", icon: Sun, entries: [forgiveness, safety] },
  sleep: { label: "أذكار النوم", icon: Moon, entries: [bedside, sleep] },
};
export type Session = keyof typeof ADHKAR_SESSIONS;
export const sessionHref = (session: Session) => "/adhkar?session=" + session;
export function suggestedSession(hours: number): Session {
  return hours >= 22 || hours < 4 ? "sleep" : hours < 15 ? "morning" : "evening";
}
function dayKey(session: Session, now = new Date()) {
  if (session === "sleep" && now.getHours() < 4) now = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return ["adhkar", session, now.getFullYear(), now.getMonth() + 1, now.getDate()].join("-");
}
type Progress = { index: number; count: number };
function fromStorage<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
}
export function routineStatus(session: Session, now?: Date) {
  const saved = fromStorage(dayKey(session, now), { index: 0, count: 0 });
  if (saved.index >= ADHKAR_SESSIONS[session].entries.length) return "done";
  return saved.index > 0 || saved.count > 0 ? "started" : "new";
}
export function sessionComplete(session: Session, now?: Date) {
  return routineStatus(session, now) === "done";
}
function SessionReader({ session }: { session: Session }) {
  const key = dayKey(session);
  const { entries, label, icon: Icon } = ADHKAR_SESSIONS[session];
  const [progress, setProgress] = useState<Progress>(() => {
    const value = fromStorage(key, { index: 0, count: 0 });
    const index = Number.isInteger(value.index) ? Math.max(0, Math.min(entries.length, value.index)) : 0;
    return { index, count: Number.isInteger(value.count) ? Math.max(0, Math.min((entries[index]?.repetitions ?? 1) - 1, value.count)) : 0 };
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    const stored = fromStorage<unknown>("meethaq-adhkar-favorites", []);
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  });
  const entry = entries[progress.index];
  const save = (value: Progress) => { setProgress(value); try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const advance = () => {
    if (!entry) return;
    save(progress.count + 1 < entry.repetitions ? { ...progress, count: progress.count + 1 } : { index: progress.index + 1, count: 0 });
  };
  const toggle = () => {
    if (!entry) return;
    const next = favorites.includes(entry.id) ? favorites.filter(id => id !== entry.id) : [...favorites, entry.id];
    setFavorites(next);
    try { localStorage.setItem("meethaq-adhkar-favorites", JSON.stringify(next)); } catch {}
  };
  const total = entries.reduce((sum, row) => sum + row.repetitions, 0);
  const read = entries.slice(0, progress.index).reduce((sum, row) => sum + row.repetitions, 0) + progress.count;
  return <section className="routine-flow" aria-label={label}>
    <div className="routine-flow-head"><span className="daily-icon"><Icon size={20} /></span><h2>{label}</h2><Link href="/adhkar">كل الأذكار</Link></div>
    <progress className="daily-progress" max={total} value={read} aria-label="تقدّم جلسة الأذكار" />
    {entry ? <article className="routine-entry" key={entry.id}>
      <div className="routine-entry-head"><h3>{entry.label}</h3><button className="icon-btn" type="button" onClick={toggle} aria-pressed={favorites.includes(entry.id)} aria-label="حفظ الذكر في المفضلة"><Heart size={19} fill={favorites.includes(entry.id) ? "currentColor" : "none"} /></button></div>
      <p className="routine-text">{entry.text}</p><small>{entry.source}</small>
      <button className="primary-cta routine-count" type="button" onClick={advance}><Check size={19} />{entry.repetitions > 1 ? <>سجّل التكرار <span className="routine-count-value" key={progress.count}>{arNumber(progress.count)} / {arNumber(entry.repetitions)}</span></> : "أتممت القراءة"}</button>
    </article> : <div className="routine-finish" role="status"><span className="daily-icon"><Check /></span><h3>أتممت جلسة {label}</h3><div className="daily-inline"><Link className="primary-cta" href="/">العودة إلى اليوم <ArrowLeft size={16} /></Link><Link className="detail-btn" href="/my-day">متابعتي</Link><button className="detail-btn" type="button" onClick={() => save({ index: 0, count: 0 })}><RotateCcw size={15} /> اقرأ مرة أخرى</button></div></div>}
  </section>;
}
export default function AdhkarRoutine() {
  const session = new URLSearchParams(useSearch()).get("session");
  if (session && Object.hasOwn(ADHKAR_SESSIONS, session)) return <SessionReader key={session} session={session as Session} />;
  const favorites = fromStorage<unknown>("meethaq-adhkar-favorites", []);
  const saved = [forgiveness, safety, bedside, sleep].filter(entry => Array.isArray(favorites) && favorites.includes(entry.id));
  const suggested = suggestedSession(new Date().getHours());
  return <>
    <section className="dhikr-hub" aria-labelledby="dhikr-sessions-title">
      <h2 id="dhikr-sessions-title">جلسات الأذكار</h2>
      <div className="routine-options">{Object.entries(ADHKAR_SESSIONS).map(([id, item]) => {
        const status = routineStatus(id as Session);
        return <Link key={id} className="dhikr-session-card" data-session={id} href={sessionHref(id as Session)}>
          <span className="daily-icon"><item.icon size={25} aria-hidden="true" /></span>
          <span className="dhikr-session-title"><strong>{item.label}</strong>{id === suggested && <small>لهذا الوقت</small>}</span>
          <span className="dhikr-session-action">{status === "done" ? "مكتملة" : status === "started" ? "تابع الجلسة" : "ابدأ الجلسة"}
            {status === "done" ? <Check size={16} /> : <ArrowLeft size={16} />}
          </span>
        </Link>;
      })}</div>
    </section>
    {saved.length > 0 && <details className="routine-saved"><summary>أذكاري المفضلة · {arNumber(saved.length)}</summary>{saved.map(entry => <article key={entry.id}><h3>{entry.label}</h3><p>{entry.text}</p><small>{entry.source}</small></article>)}</details>}
  </>;
}
