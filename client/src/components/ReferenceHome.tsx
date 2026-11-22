import { useRef, useState, type ReactNode } from "react";
import {
  Bell, BookOpen, ChevronLeft, ChevronRight, Compass, GraduationCap, Home,
  Landmark, Layers2, LayoutDashboard, Menu, Play, RotateCcw, Search, Sunrise,
} from "lucide-react";
import { useLocation } from "wouter";
import MithaqBrand from "@/components/MithaqBrand";
import MotionLink from "@/components/MotionLink";
import { useVisitHistory } from "@/lib/visitHistory";
import useReferenceReveal from "@/hooks/useReferenceReveal";

const destinations = {
  home: { label: "الرئيسية", href: "/", icon: Home },
  quran: { label: "القرآن الكريم", href: "/quran", icon: BookOpen },
  plan: { label: "الختمة", href: "/khatma", icon: Layers2 },
  prayer: { label: "الصلاة", href: "/prayer", icon: Landmark },
  dhikr: { label: "الأذكار", href: "/adhkar", icon: Sunrise },
  learning: { label: "تعلّم", href: "/learning", icon: GraduationCap },
  tasbih: { label: "السبحة", href: "/tasbih", icon: RotateCcw },
  personal: { label: "متابعتي", href: "/my-day", icon: LayoutDashboard },
  explore: { label: "استكشف", href: "/explore", icon: Compass },
  settings: { label: "الإعدادات والتنبيهات", href: "/settings", icon: Bell },
} as const;
type Destination = keyof typeof destinations;
const topNav: Destination[] = ["home", "quran", "prayer", "dhikr", "learning"];
const sideNav: Destination[] = ["plan", "tasbih", "personal", "explore"];

function NavigationItems({ items, onNavigate }: { items: Destination[]; onNavigate?: () => void }) {
  const [path] = useLocation();
  return items.map(key => {
    const { label, href, icon: Icon } = destinations[key];
    return <MotionLink key={key} href={href} onClick={onNavigate} aria-current={path === href ? "page" : undefined}>
      <Icon size={21} aria-hidden="true" /><span>{label}</span>
    </MotionLink>;
  });
}

export function MithaqMobileLinks({ onNavigate }: { onNavigate: () => void }) {
  return <NavigationItems items={[...topNav, ...sideNav, "settings"]} onNavigate={onNavigate} />;
}

export function MithaqSidebar() {
  return <aside className="reference-side" aria-label="أقسام ميثاق">
    <nav className="reference-side-nav" aria-label="أدوات ميثاق"><NavigationItems items={sideNav} /></nav>
    <div className="reference-sidebar-art" aria-hidden="true" />
  </aside>;
}

export function ReferenceHeader({ onMenu, menuOpen, onSearch, account }: {
  onMenu: () => void;
  menuOpen: boolean;
  onSearch: () => void;
  account: ReactNode;
}) {
  return <header className="site-header reference-header" dir="rtl">
    <svg className="reference-optics" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter id="mithaq-liquid-lens" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage href="/images/reference-refraction.png" x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none" result="lensMap" />
          <feDisplacementMap in="SourceGraphic" in2="lensMap" scale="19" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
    <div className="reference-header-row">
      <MithaqBrand />
      <nav className="reference-top-nav" aria-label="التنقل الرئيسي" dir="rtl"><NavigationItems items={topNav} /></nav>
      <div className="reference-header-actions">
        <button className="reference-search" type="button" aria-label="بحث (Ctrl+K)" onClick={onSearch}><Search size={23} aria-hidden="true" /><span>ابحث في ميثاق…</span></button>
        <MotionLink className="reference-round" href="/settings" aria-label="إعدادات التنبيهات"><Bell size={29} aria-hidden="true" /></MotionLink>
        {account}
        <button className="reference-round reference-menu" type="button" onClick={onMenu} aria-label="فتح القائمة" aria-expanded={menuOpen} aria-controls={menuOpen ? "launch-mobile-menu" : undefined}><Menu size={23} /></button>
      </div>
    </div>
  </header>;
}

const slides = [
  { title: "مِيثَاق", subtitle: "رفقةٌ على هدي الوحي", copy: "اقرأ وردك، وحافظ على أذكارك، وتابع ما بدأت من تعلّم.", button: "افتح خطة الختمة", href: "/khatma" },
  { title: "القرآن الكريم", subtitle: "اقرأ واستمع وتدبّر", copy: "افتح المصحف وتابع من موضعك المحفوظ.", button: "افتح المصحف", href: "/quran" },
  { title: "تعلّم", subtitle: "بودكاست ودورات", copy: "شاهد حلقة مختارة أو ابدأ دورة في موضوع يهمّك.", button: "افتح التعلّم", href: "/learning" },
] as const;
const tiles = [
  { id: "quran", art: "quran", copy: "المصحف والتلاوة والتفسير" },
  { id: "plan", art: "plan", copy: "خطّط لوردك وتابع قراءتك" },
  { id: "prayer", art: "prayer", copy: "المواقيت واتجاه القبلة" },
  { id: "dhikr", art: "dhikr", copy: "أذكار الصباح والمساء والنوم" },
  { id: "tasbih", art: "tasbih", copy: "عدّاد يحفظ عددك" },
  { id: "learning", art: "lecture", copy: "بودكاست ودورات دينية" },
] as const;

export default function ReferenceHome({ readingHref, wardHref, ready, children }: {
  readingHref: string;
  wardHref: string;
  ready: boolean;
  children: ReactNode;
}) {
  const [scene, setScene] = useState({ index: 0, previous: null as number | null, direction: 1, version: 0 });
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const slide = scene.index;
  useVisitHistory();
  const root = useRef<HTMLDivElement>(null);
  useReferenceReveal(root);
  const panel = slides[slide];

  function changeSlide(getIndex: (index: number) => number, direction?: number) {
    setScene(current => {
      const index = getIndex(current.index);
      if (index === current.index) return current;
      return { index, previous: current.index, direction: direction ?? Math.sign(index - current.index), version: current.version + 1 };
    });
  }
  const advance = (direction: number) => changeSlide(index => (index + direction + slides.length) % slides.length, direction);
  return <div className="reference-home" ref={root}>
    <div className="reference-main">
      <section className="reference-hero" tabIndex={0} aria-label="مشاهد ميثاق" data-direction={scene.direction > 0 ? "next" : "previous"} data-glass-light
        onKeyDown={event => {
          if (event.target !== event.currentTarget || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
          event.preventDefault();
          advance(event.key === "ArrowLeft" ? 1 : -1);
        }}
        onTouchStart={event => {
          const touch = event.touches[0];
          touchStart.current = event.touches.length === 1 && touch && event.target instanceof Element && !event.target.closest("a,button")
            ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchCancel={() => { touchStart.current = null; }}
        onTouchEnd={event => {
          const start = touchStart.current;
          const end = event.changedTouches[0];
          touchStart.current = null;
          if (!start || !end) return;
          const dx = end.clientX - start.x;
          const dy = end.clientY - start.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) advance(dx > 0 ? 1 : -1);
        }}>
        <div className="reference-hero-media" aria-hidden="true">
          {scene.previous !== null && <div className="reference-hero-art scene-outgoing" data-story={scene.previous} key={scene.version + "-out"}
            onAnimationEnd={() => setScene(current => current.version === scene.version ? { ...current, previous: null } : current)} />}
          <div className="reference-hero-art scene-current" key={scene.version} data-story={slide} />
        </div>
        <div className="reference-hero-copy" key={slide} aria-live="polite">
          <h1>{panel.title}</h1>
          <h2>{panel.subtitle}</h2>
          <p>{panel.copy}</p>
          <div className="reference-hero-actions">
            <MotionLink className="reference-gold" href={slide === 1 ? readingHref : slide === 2 || (slide === 0 && ready) ? wardHref : panel.href}><Play size={20} aria-hidden="true" />{slide === 0 && ready ? "تابع وردك" : panel.button}</MotionLink>
            <a className="reference-outline" href="#reference-features"><Compass size={22} aria-hidden="true" />تصفّح الأقسام</a>
          </div>
        </div>
        <button type="button" className="reference-arrow reference-hero-prev" aria-label="الشريحة السابقة" onClick={() => advance(-1)}><ChevronRight aria-hidden="true" /></button>
        <button type="button" className="reference-arrow reference-hero-next" aria-label="الشريحة التالية" onClick={() => advance(1)}><ChevronLeft aria-hidden="true" /></button>
        <div className="reference-dots" role="group" aria-label="شرائح الرئيسية">
          {slides.map(({ title }, index) => <button key={title} type="button" aria-pressed={slide === index} aria-label={title} onClick={() => changeSlide(() => index)}><span /></button>)}
        </div>
      </section>
      <nav id="reference-features" className="reference-tiles" aria-label="أقسام ميثاق" data-reveal>
        {tiles.map(({ id, art, copy }) => {
          const { label, href, icon: Icon } = destinations[id];
          return <MotionLink key={id} className="reference-glass reference-feature" data-color={art} data-glass-light data-glass-tilt
            href={id === "quran" ? readingHref : href}>
            <span className="mithaq-feature-mark"><Icon size={28} aria-hidden="true" /></span>
            <b>{label}</b><span>{copy}</span><i aria-hidden="true"><Play size={11} fill="currentColor" /></i>
          </MotionLink>;
        })}
      </nav>
      <div className="reference-details" data-reveal>{children}</div>
    </div>
    <MithaqSidebar />
  </div>;
}
