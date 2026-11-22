import { useState } from "react";
import { Link } from "wouter";
import { BookOpen, Check } from "lucide-react";
import { arNumber, dailyPortion, readPlan, recordPages } from "@/lib/khatma";

export default function WardReader() {
  const [plan, setPlan] = useState(readPlan);
  const portion = plan && dailyPortion(plan);
  const complete = portion && !portion.overdue && portion.remaining === 0;
  return <aside className={`ward-reader${complete ? " ward-complete" : ""}`} id="daily-ward-reader">
    <span className="daily-icon">{complete ? <Check size={20} /> : <BookOpen size={20} />}</span>
    <div><h2>{complete ? "أتممت ورد اليوم" : "ورد القرآن"}</h2>
      {portion && !complete && !portion.overdue && <p>من الصفحة {arNumber(portion.first)} إلى {arNumber(portion.last)}</p>}
    </div>
    {complete ? <Link href="/learning?view=podcasts&topic=quran" className="detail-btn">حلقات عن تدبّر القرآن</Link>
      : !portion || portion.overdue ? <Link href="/khatma" className="detail-btn">عرض الخطة</Link>
      : <button className="detail-btn" type="button" onClick={() => setPlan(recordPages("today"))}>سجّل إتمام الورد</button>}
    <span className="sr-only" role="status">{complete ? "سُجّل إتمام الورد" : ""}</span>
  </aside>;
}
