import MithaqBrand from "@/components/MithaqBrand";
import { AlertCircle, Home } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";

// Hosting answers this path with HTTP 404 while still serving the app.
const NOT_FOUND_PATH = "/404";

// Render for unknown routes and for items the server confirmed missing (e.g. `/page/:id`).
// The redirect is irreversible: never render while loading, on other errors, or before auth resolves.
export default function NotFound() {
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);

    // Full-page navigation: a client-side route change sends no request, so no 404 status.
    if (window.location.pathname.replace(/\/$/, "") !== NOT_FOUND_PATH) {
      window.location.replace(NOT_FOUND_PATH);
    }

    return () => robots.remove();
  }, []);

  return <main dir="rtl" className="meethaq-app launch-shell launch-clean atmosphere-shell reference-shell mithaq-inner-shell release-not-found">
    <section className="companion-panel">
      <MithaqBrand />
      <span className="launch-tile-icon"><AlertCircle size={22} aria-hidden="true" /></span>
      <h1>الصفحة غير موجودة</h1>
      <p>يمكنك متابعة القراءة والأذكار والتعلّم من الرئيسية.</p>
      <div id="not-found-button-group"><Link className="companion-primary" href="/"><Home size={17} aria-hidden="true" />العودة إلى مِيثَاق</Link></div>
    </section>
  </main>;
}
