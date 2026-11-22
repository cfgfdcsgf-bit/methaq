import { Bell, BookOpen, CalendarDays, Calculator, Compass, GraduationCap, HandHeart, Headphones, Home, LibraryBig, Mic2, Moon, RotateCcw, ScrollText, Sparkles, Star, Sunrise, Target, Trophy, Users } from "lucide-react";

export const sections = [
  { id: "today", href: "/", label: "اليوم", icon: Home, title: "العبادة اليومية", description: "مواقيت الصلاة والسبحة ومتابعة وردك.", featured: ["/prayer", "/tasbih", "/my-day", "/ramadan"], entries: [
    { href: "/prayer", name: "مواقيت الصلاة والقبلة", description: "الصلاة القادمة والاتجاه حسب مدينتك.", icon: Compass, keywords: "الفجر أذان مواقيت اتجاه" },
    { href: "/tasbih", name: "السبحة", description: "عدّاد يُحفظ محليًا ويُزامن مع الحساب عند تسجيل الدخول.", icon: RotateCcw, keywords: "تسبيح عداد" },
    { href: "/salah", name: "تعلّم الصلاة", description: "تابع خطوات الوضوء والصلاة.", icon: Sunrise, keywords: "وضوء طهارة" },
    { href: "/ramadan", name: "رمضان", description: "إمساكية مدينتك وورد الشهر.", icon: Moon, keywords: "صيام إمساكية فطور" },
    { href: "/zakat", name: "حاسبة الزكاة", description: "احسب الزكاة على المال الذي تحدده.", icon: Calculator },
    { href: "/hajj", name: "الحج والعمرة", description: "دليل المناسك من الإحرام إلى الطواف.", icon: Compass },
    { href: "/events", name: "المناسبات الإسلامية", description: "تابع التقويم الهجري والمواعيد التقريبية.", icon: CalendarDays },
    { href: "/settings", name: "الإعدادات والتنبيهات", description: "خصّص تذكيرات هذا الجهاز.", icon: Bell, keywords: "تثبيت تطبيق إشعارات" },
    { href: "/my-day", name: "متابعتي", description: "تابع وردك وأذكارك وسجلّ صلاتك.", icon: CalendarDays, keywords: "لوحة تحكم تقدم تنبيه" },
    { href: "/achievements", name: "أيام الاستخدام", description: "راجع أيام استخدامك لمِيثَاق.", icon: Trophy, keywords: "الإنجازات تقدم" },
  ] },
  { id: "quran", href: "/quran", label: "القرآن", icon: BookOpen, title: "المصحف والختمة", description: "اقرأ وتابع وردك من المصحف نفسه.", featured: ["/quran", "/khatma"], entries: [
    { href: "/quran", name: "المصحف الشريف", description: "اقرأ الآيات واستمع لتلاوتها وافتح تفسيرها.", icon: BookOpen, keywords: "قرآن" },
    { href: "/khatma", name: "مخطط الختمة", description: "حدّد مدتك وتابع وردك اليومي.", icon: CalendarDays, keywords: "ورد ختمة تقدم" },
    { href: "/tajweed", name: "التجويد", description: "تعلّم أحكام التلاوة خطوةً خطوة.", icon: Mic2 },
    { href: "/hifz", name: "رفيق الحفظ", description: "أدوات ودروس تعينك على الحفظ والمراجعة.", icon: Target },
    { href: "/learning?view=podcasts&topic=quran", name: "تدبّر القرآن", description: "حلقات عن فهم القرآن والعمل به.", icon: BookOpen, keywords: "تفسير فهم شرح" },
  ] },
  { id: "adhkar", href: "/adhkar", label: "الأذكار", icon: Sunrise, title: "الأذكار والأدعية", description: "جلسات للذكر اليومي وأدعية لمواقف مختلفة.", featured: ["/adhkar", "/duas"], entries: [
    { href: "/adhkar", name: "الأذكار اليومية", description: "أذكار الصباح والمساء والنوم في مكان واحد.", icon: Sunrise },
    { href: "/adhkar?session=morning", name: "أذكار الصباح", description: "افتح جلسة الصباح وتابع التكرار.", icon: Sunrise },
    { href: "/adhkar?session=evening", name: "أذكار المساء", description: "ابدأ جلسة المساء أو تابع من مكانك.", icon: Moon },
    { href: "/adhkar?session=sleep", name: "أذكار النوم", description: "افتح جلسة الأذكار قبل النوم.", icon: Moon },
    { href: "/duas", name: "الأدعية المأثورة", description: "أدعية من السنة لمواقف مختلفة.", icon: HandHeart },
  ] },
  { id: "learn", href: "/learning", label: "تعلّم", icon: GraduationCap, title: "تعلّم", description: "بودكاست ودورات دينية ومواد للقراءة.", featured: ["/learning?view=podcasts", "/learning?view=courses", "/library"], entries: [
    { href: "/learning?view=podcasts", name: "البودكاست الديني", description: "حلقات مختارة من قنوات أصحابها.", icon: Headphones, keywords: "فيديو فاهم وعي فنجان" },
    { href: "/learning?view=courses", name: "الدورات الدينية", description: "دورات تفتح من منصّات مقدّميها.", icon: GraduationCap, keywords: "كورسات أكاديمية زاد زادي" },
    { href: "/sunnah", name: "السنة النبوية", description: "أحاديث للقراءة والبحث.", icon: ScrollText, keywords: "حديث أحاديث البخاري مسلم" },
    { href: "/seerah", name: "السيرة النبوية", description: "حياة النبي ﷺ على خط زمني.", icon: Compass },
    { href: "/names", name: "أسماء الله الحسنى", description: "معاني الأسماء وأدلتها.", icon: Star },
    { href: "/prophets", name: "قصص الأنبياء", description: "اقرأ القصص وتابع شواهدها من المصحف.", icon: BookOpen },
    { href: "/fiqh", name: "الفقه المبسّط", description: "أبواب في العبادات والمعاملات.", icon: GraduationCap },
    { href: "/library", name: "المكتبة", description: "مواد في التفسير والسيرة والعلوم.", icon: LibraryBig },
    { href: "/kids", name: "ركن الأطفال", description: "موضوعات تقرؤها الأسرة مع الطفل.", icon: Users },
    { href: "/rafiq", name: "رفيق", description: "مساعد للأسئلة والتعلّم.", icon: Sparkles, keywords: "ذكاء اصطناعي مساعد" },
  ] },
] as const;

export type Section = (typeof sections)[number];
export type SectionId = Section["id"];
export type Entry = Section["entries"][number];
export const directoryHref = (section: SectionId) => "/explore?section=" + section;
export function selectedSection(id: string | null) {
  return sections.find(section => section.id === id) ?? sections[0];
}
export function featuredDestinations(section: Section): Entry[] {
  return section.featured.flatMap(href => section.entries.filter(entry => entry.href === href));
}
export function sectionForPath(path: string, search = "") {
  const exact = path + (search ? "?" + search : "");
  if (path === "/explore") return selectedSection(new URLSearchParams(search).get("section"));
  return sections.find(section => section.entries.some(entry => entry.href === exact))
    ?? sections.find(section => section.href === path)
    ?? sections.find(section => section.entries.some(entry => entry.href === path))
    ?? (path === "/tools" ? sections[0] : undefined);
}
function normalize(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/ـ/g, "").replace(/ى/g, "ي").replace(/ة/g, "ه").trim();
}
export function findDestinations(query: string) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return sections.flatMap(section => {
    const index = [
      ...section.entries,
      ...(!section.entries.some(entry => entry.href === section.href) ? [
      { href: section.href, name: section.label, description: section.description, icon: section.icon, keywords: section.title },
      ] : []),
    ];
    return index.flatMap(entry => {
      const target = normalize([entry.name, entry.description, "keywords" in entry ? entry.keywords : ""].join(" "));
      return terms.every(term => target.includes(term)) ? [{ entry, section }] : [];
    });
  });
}
