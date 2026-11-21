import type { ComponentPropsWithoutRef } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation, useSearch } from "wouter";

type MotionLinkProps = ComponentPropsWithoutRef<"a"> & { href: string; motion?: "route" | "prayer" };
let current: ViewTransition | undefined;
let navigation = 0;

export default function MotionLink({ href, motion = "route", onClick, ...props }: MotionLinkProps) {
  const [path, go] = useLocation();
  const search = useSearch();
  const here = path + (search ? "?" + search : "");
  return <Link {...props} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || href === here || href.includes("#") || props.target || props.download
      || !document.startViewTransition || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    event.preventDefault();
    const sequence = ++navigation;
    current?.skipTransition();
    const root = document.documentElement;
    root.dataset.meethaqMotion = motion;
    const update = () => {
      if (sequence === navigation) flushSync(() => go(href));
    };
    try {
      const transition = document.startViewTransition(update);
      current = transition;
      const clear = () => {
        if (current !== transition) return;
        current = undefined;
        delete root.dataset.meethaqMotion;
      };
      void transition.ready.catch(() => {});
      void transition.updateCallbackDone.catch(() => {});
      void transition.finished.then(clear, clear);
    } catch {
      delete root.dataset.meethaqMotion;
      update();
    }
  }} />;
}
