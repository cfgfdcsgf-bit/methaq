import { useEffect, type RefObject } from "react";

const surfaces = "[data-glass-light],.glass-heading,.dhikr-session-card,.learning-card,.directory-entries a,.owner-control-card,.companion-panel";
const motionAllowed = "(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)";

export default function useGlassLight(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const shell = root.current;
    if (!shell) return;
    const preference = matchMedia(motionAllowed);
    let active: HTMLElement | null = null;
    let frame = 0;
    let clientX = 0;
    let clientY = 0;

    function reset() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (!active) return;
      active.removeAttribute("data-glass-active");
      active.style.removeProperty("--art-x");
      active.style.removeProperty("--art-y");
      active.style.removeProperty("--tilt-x");
      active.style.removeProperty("--tilt-y");
      active = null;
    }

    function update() {
      frame = 0;
      if (!active) return;
      const rect = active.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      active.style.setProperty("--light-x", `${x * 100}%`);
      active.style.setProperty("--light-y", `${y * 100}%`);
      active.style.setProperty("--art-x", `${(x - 0.5) * 16}px`);
      active.style.setProperty("--art-y", `${(y - 0.5) * 12}px`);
      if (active.hasAttribute("data-glass-tilt")) {
        active.style.setProperty("--tilt-x", `${(0.5 - y) * 5}deg`);
        active.style.setProperty("--tilt-y", `${(x - 0.5) * 5}deg`);
      }
      active.setAttribute("data-glass-active", "");
    }

    function move(event: PointerEvent) {
      if (!preference.matches || event.pointerType !== "mouse" || document.documentElement.dataset.effects === "reduced") return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(surfaces) : null;
      if (target !== active) {
        reset();
        active = target;
      }
      if (!active) return;
      clientX = event.clientX;
      clientY = event.clientY;
      if (!frame) frame = requestAnimationFrame(update);
    }

    function out(event: PointerEvent) {
      if (active && (!(event.relatedTarget instanceof Node) || !active.contains(event.relatedTarget))) reset();
    }

    shell.addEventListener("pointermove", move, { passive: true });
    shell.addEventListener("pointerout", out, { passive: true });
    window.addEventListener("scroll", reset, { passive: true });
    preference.addEventListener("change", reset);
    return () => {
      reset();
      shell.removeEventListener("pointermove", move);
      shell.removeEventListener("pointerout", out);
      window.removeEventListener("scroll", reset);
      preference.removeEventListener("change", reset);
    };
  }, [root]);
}
