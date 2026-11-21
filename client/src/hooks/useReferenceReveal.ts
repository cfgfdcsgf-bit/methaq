import { useEffect, type RefObject } from "react";

export default function useReferenceReveal(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        target.removeAttribute("data-reveal-pending");
        observer.unobserve(target);
      }
    }, { rootMargin: "0px 0px 24px" });
    for (const element of targets) {
      if (element.getBoundingClientRect().top < window.innerHeight) continue;
      element.setAttribute("data-reveal-pending", "");
      observer.observe(element);
    }
    return () => {
      observer.disconnect();
      targets.forEach(target => target.removeAttribute("data-reveal-pending"));
    };
  }, [ref]);
}
