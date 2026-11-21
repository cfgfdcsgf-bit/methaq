import { GraduationCap, Headphones } from "lucide-react";
import { Link, useSearch } from "wouter";
import LearningMedia from "@/components/LearningMedia";
import { learningTopics, type LearningTopic } from "@/data/learning-media";
import "@/learning.css";

const tabs = [
  { view: "podcasts", label: "البودكاست", icon: Headphones },
  { view: "courses", label: "الدورات", icon: GraduationCap },
] as const;

export default function LearningPage() {
  const params = new URLSearchParams(useSearch());
  const view = params.get("view") === "courses" ? "courses" : "podcasts";
  const queryTopic = params.get("topic");
  const topic = queryTopic && Object.hasOwn(learningTopics, queryTopic) ? queryTopic as LearningTopic : "";

  return <main className="section-wrap section-page learning-page" dir="rtl">
    <header className="learning-hub-heading">
      <h1>تعلّم</h1>
      <p>شاهد بودكاست ديني، أو اختر دورة وابدأ من موقع ناشرها.</p>
    </header>
    <nav className="learning-hub-tabs" aria-label="أقسام التعلّم">{tabs.map(item =>
      <Link key={item.view} href={`/learning?view=${item.view}`} aria-current={item.view === view ? "page" : undefined}>
        <item.icon size={19} aria-hidden="true" />{item.label}
      </Link>)}</nav>
    <LearningMedia key={view + ":" + topic} view={view} initialTopic={topic} />
  </main>;
}
