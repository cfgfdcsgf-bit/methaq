import { useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Check, Minus, RotateCcw, Vibrate } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { arNumber, localDay } from "@/lib/khatma";
import "@/tasbih.css";

const presets = [33, 100, 1000];
const maxGoal = 999_999;
const maxCount = 999_999_999;
const phrases = ["سبحان الله", "الحمد لله", "الله أكبر", "لا إله إلا الله", "أستغفر الله"];

function readSetting(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeSetting(key: string, value: number | boolean | string) {
  try { localStorage.setItem(key, String(value)); } catch { /* The counter works for this session. */ }
}

function readStats(): Record<string, number> {
  try {
    const value = JSON.parse(readSetting("meethaq-tasbih-stats") ?? "{}");
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] =>
      /^\d{5}$/.test(entry[0]) && typeof entry[1] === "number" && Number.isSafeInteger(entry[1]) && entry[1] >= 0));
  } catch { return {}; }
}

export default function TasbihPage() {
  const [count, setCount] = useState(() => {
    const saved = Number(readSetting("tasbih"));
    return Number.isSafeInteger(saved) && saved >= 0 && saved <= maxCount ? saved : 0;
  });
  const [goal, setGoal] = useState(() => {
    const saved = Number(readSetting("meethaq-tasbih-goal"));
    return Number.isInteger(saved) && saved > 0 && saved <= maxGoal ? saved : 33;
  });
  const [customGoal, setCustomGoal] = useState("");
  const [phrase, setPhrase] = useState(() => {
    const saved = readSetting("meethaq-tasbih-phrase");
    return saved && phrases.includes(saved) ? saved : phrases[0];
  });
  const [stats, setStats] = useState(readStats);
  const [haptics, setHaptics] = useState(() => readSetting("meethaq-tasbih-haptics") !== "false");
  const revision = useRef(0);
  const remaining = Math.max(0, goal - count);

  function updateCount(next: number, logDelta = true) {
    revision.current += 1;
    setCount(next);
    writeSetting("tasbih", next);
    if (logDelta) {
      const today = localDay();
      const nextStats = Object.fromEntries(Object.entries(stats).filter(([day]) => Number(day) >= today - 29));
      nextStats[today] = Math.max(0, (stats[today] ?? 0) + next - count);
      setStats(nextStats);
      writeSetting("meethaq-tasbih-stats", JSON.stringify(nextStats));
    }
    if (next === goal && count < goal && haptics) navigator.vibrate?.(45);
  }

  function updateGoal(next: number) {
    if (!Number.isInteger(next) || next < 1 || next > maxGoal) return;
    setGoal(next);
    writeSetting("meethaq-tasbih-goal", next);
    setCustomGoal("");
  }

  function reset() {
    const previous = count;
    updateCount(0, false);
    const resetRevision = revision.current;
    toast("صُفّر العدّاد", { action: { label: "تراجع", onClick: () => {
      if (revision.current === resetRevision) updateCount(previous, false);
    } } });
  }

  return <main className="section-wrap section-page tasbih-page" dir="rtl">
    <header className="tasbih-heading"><h1>السبحة</h1><Link href="/">الرئيسية <ArrowLeft size={17} aria-hidden="true" /></Link></header>
    <section className="tasbih-workspace" aria-label="عدّاد التسبيح">
      <div className="tasbih-counter">
        <div className="tasbih-ring" style={{ "--tasbih-progress": Math.min(1, count / goal) * 100 + "%" } as CSSProperties}>
          <button type="button" className="tasbih-count-button" aria-label="زيادة العدّاد" disabled={count >= maxCount} onClick={() => updateCount(count + 1)}>
            <strong>{arNumber(count)}</strong><span>{phrase}</span>
          </button>
        </div>
        <p className="tasbih-feedback" role="status">
          {remaining > 0 ? <>العدد {arNumber(count)} · باقي {arNumber(remaining)} لهدفك الشخصي</> : <><Check size={17} aria-hidden="true" /> أتممت هدفك الشخصي</>}
        </p>
        <div className="tasbih-actions">
          <button type="button" onClick={() => updateCount(count - 1)} disabled={!count} aria-label="أنقص واحدًا"><Minus size={17} aria-hidden="true" /> واحد</button>
          <button type="button" onClick={reset} disabled={!count}><RotateCcw size={17} aria-hidden="true" /> تصفير</button>
          {typeof navigator.vibrate === "function" && <button type="button" aria-pressed={haptics} onClick={() => {
            setHaptics(!haptics);
            writeSetting("meethaq-tasbih-haptics", !haptics);
          }}><Vibrate size={17} aria-hidden="true" /> اهتزاز</button>}
        </div>
      </div>
      <div className="tasbih-goals">
        <h2>الهدف الشخصي</h2>
        <label className="tasbih-phrase">الذكر <select value={phrase} onChange={event => {
          setPhrase(event.target.value);
          writeSetting("meethaq-tasbih-phrase", event.target.value);
        }}>{phrases.map(value => <option key={value}>{value}</option>)}</select></label>
        <div className="tasbih-presets" role="group" aria-label="أهداف جاهزة">
          {presets.map(value => <button key={value} type="button" aria-pressed={goal === value} onClick={() => updateGoal(value)}>{arNumber(value)}</button>)}
        </div>
        <form className="tasbih-custom-goal" onSubmit={event => { event.preventDefault(); updateGoal(Number(customGoal)); }}>
          <input type="number" inputMode="numeric" min={1} max={maxGoal} required value={customGoal}
            aria-label="عدد الهدف المخصّص" placeholder="هدف مخصّص" onChange={event => setCustomGoal(event.target.value)} />
          <button type="submit">حفظ</button>
        </form>
        <p>هدفك الحالي {arNumber(goal)}. يُحفظ العدّاد محليًا، ويُزامن مع الحساب عند تسجيل الدخول والاتصال.</p>
        <dl className="tasbih-summary">
          <div><dt>تسبيحات اليوم</dt><dd>{arNumber(stats[localDay()] ?? 0)}</dd></div>
          <div><dt>آخر سبعة أيام</dt><dd>{arNumber(Array.from({ length: 7 }, (_, index) => stats[localDay() - index] ?? 0).reduce((sum, day) => sum + day, 0))}</dd></div>
        </dl>
      </div>
    </section>
  </main>;
}
