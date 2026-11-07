import { useEffect } from "react";

const TILT = ".page-hero,.tool-card,.pray-card,.start-card,.mat-card,.library-card,.feature-card,.login-card,.continue-card,.daily-card,.tasbih-card,.control-card,.atlas-card,.ex-card";
const REVEAL = ".section-heading,.start-card,.mat-card,.library-card,.continue-card,.daily-card,.feature-card,.login-card,.privacy-list>div,.empty-box,.atlas-card,.ex-card,.tl-item";

/** Mouse-driven 3D tilt + glare on cards, and scroll-reveal. Pure DOM, no per-card JSX needed. */
export function useFx() {
  useEffect(() => {
    const fine = window.matchMedia("(pointer:fine)").matches;
    const move = (e: PointerEvent) => {
      const t = (e.target as HTMLElement | null)?.closest?.(TILT) as HTMLElement | null;
      if (!t) return;
      const r = t.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      t.style.setProperty("--rx", `${((0.5 - y) * 9).toFixed(2)}deg`);
      t.style.setProperty("--ry", `${((x - 0.5) * 9).toFixed(2)}deg`);
      t.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      t.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      t.classList.add("tilting");
    };
    const leave = (e: PointerEvent) => {
      const t = (e.target as HTMLElement | null)?.closest?.(TILT) as HTMLElement | null;
      if (!t) return;
      t.style.setProperty("--rx", "0deg"); t.style.setProperty("--ry", "0deg"); t.classList.remove("tilting");
    };
    const bar = document.createElement("div"); bar.className = "scroll-progress"; document.body.appendChild(bar);
    const onScroll = () => { const h = document.documentElement; bar.style.width = `${(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100}%`; };
    const aur = (e: PointerEvent) => { document.documentElement.style.setProperty("--gx", `${e.clientX}px`); document.documentElement.style.setProperty("--gy", `${e.clientY}px`); };
    window.addEventListener("scroll", onScroll, { passive: true }); if (fine) document.addEventListener("pointermove", aur);
    if (fine) { document.addEventListener("pointermove", move); document.addEventListener("pointerout", leave); }

    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: 0.12 });
    const scan = () => document.querySelectorAll<HTMLElement>(REVEAL).forEach(el => { if (!el.classList.contains("rv")) { el.classList.add("rv"); io.observe(el); } });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { bar.remove(); window.removeEventListener("scroll", onScroll); document.removeEventListener("pointermove", aur); document.removeEventListener("pointermove", move); document.removeEventListener("pointerout", leave); io.disconnect(); mo.disconnect(); };
  }, []);
}
