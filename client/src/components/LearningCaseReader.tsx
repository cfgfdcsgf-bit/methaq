import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ListChecks } from "lucide-react";
import { Link } from "wouter";
import { type LearningCase, type LearningDecision } from "@/data/learning-cases";

const number = new Intl.NumberFormat("ar-EG");

function Decision({ decision, final, onContinue }: {
  decision: LearningDecision; final: boolean; onContinue: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [reviewed, setReviewed] = useState<number | null>(null);
  const correct = reviewed === decision.best;
  const feedback = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reviewed !== null) feedback.current?.focus();
  }, [reviewed]);

  return <section className="learning-decision">
    <p>{decision.context}</p>
    <form onSubmit={event => { event.preventDefault(); if (selected !== null) setReviewed(selected); }}>
      <fieldset disabled={correct}>
        <legend>{decision.question}</legend>
        {decision.choices.map((choice, index) => <label className="learning-choice" key={choice.text}>
          <input
            type="radio" name="learning-decision" checked={selected === index}
            onChange={() => { setSelected(index); setReviewed(null); }}
          />
          <span>{choice.text}</span>
        </label>)}
      </fieldset>
      {reviewed !== null && <div
        className="learning-feedback" data-correct={correct} tabIndex={-1} ref={feedback}
      >
        <strong>{correct ? "اختيار مناسب" : "راجع هذه النقطة"}</strong>
        <p>{decision.choices[reviewed].feedback}</p>
      </div>}
      {correct ? <button className="learning-complete" type="button" onClick={onContinue}>
        {final ? "اقرأ خلاصة الموقف" : "القرار التالي"} <ArrowLeft size={17} aria-hidden="true" />
      </button> : <button className="learning-complete" type="submit" disabled={selected === null || selected === reviewed}>
        راجع اختياري
      </button>}
    </form>
  </section>;
}

export default function LearningCaseReader({ activity, onFinish }: { activity: LearningCase; onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const finished = step === activity.decisions.length;

  useEffect(() => {
    const target = step === 0 ? title.current : heading.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start" });
  }, [step]);

  return <>
    <header className="learning-case-head learning-course-head">
      <Link className="learning-back" href="/learning?view=practice"><ArrowRight size={16} aria-hidden="true" /> كل التطبيقات</Link>
      <div className="learning-lesson-position">{activity.skill}</div>
      <h1 tabIndex={-1} ref={title}>{activity.title}</h1>
      <p>{activity.scenario}</p>
    </header>
    <article className="learning-case-reader learning-reader" aria-labelledby="case-step">
      <h2 id="case-step" tabIndex={-1} ref={heading}>
        {finished ? "خلاصة الموقف" : `القرار ${number.format(step + 1)} من ${number.format(activity.decisions.length)}`}
      </h2>
      {finished ? <>
        <p className="learning-case-takeaway"><Check size={20} aria-hidden="true" /> {activity.takeaway}</p>
        <section className="learning-practice">
          <h3><ListChecks size={19} aria-hidden="true" /> جرّبها في موقف آخر</h3>
          <p>{activity.transfer}</p>
        </section>
        <p className="learning-reference"><strong>المرجع</strong><span>{activity.reference}</span></p>
        <div className="learning-case-actions">
          <Link className="learning-complete" href={`/learning?course=${activity.course}&lesson=${activity.lesson}`}>
            اقرأ الدرس المرتبط <ArrowLeft size={17} aria-hidden="true" />
          </Link>
          <button type="button" onClick={() => setStep(0)}>أعد التطبيق</button>
        </div>
      </> : <Decision key={step} decision={activity.decisions[step]} final={step + 1 === activity.decisions.length} onContinue={() => {
        if (step + 1 === activity.decisions.length) onFinish();
        setStep(step + 1);
      }} />}
    </article>
  </>;
}
