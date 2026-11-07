import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { startLogin } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import type { Message as ChatMessage } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import ContentPage, { KINDS, type Kind } from "@/components/ContentPage";
import HeroArt from "@/components/HeroArt";
import QuranPassages from "@/components/QuranPassages";
import SearchPalette from "@/components/SearchPalette";
import { useFx } from "@/lib/fx";
import { Atlas, ExplorePage, isExplore } from "@/components/Explore";
import { TodayStrip, ToolsHub, PrayerPage, KhatmaPage, ZakatPage, Hero, QuranQuote } from "@/components/Tools";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowUpLeft, BookOpen, Check,
  CircleHelp, Compass, LibraryBig,
  Menu, Moon, Play, Search, ShieldCheck, Sparkles, Star, Target,
  UserRound, X, Sun, RotateCcw, Home as HomeIcon, LogOut
} from "lucide-react";

const AIChatBox = lazy(() => import("@/components/AIChatBox").then(module => ({ default: module.AIChatBox })));
const AdminContent = lazy(() => import("@/components/AdminContent"));

const navItems = [
  { href: "/quran", label: "القرآن الكريم", icon: BookOpen },
  { href: "/sunnah", label: "السنة النبوية", icon: Star },
  { href: "/library", label: "المكتبة", icon: LibraryBig },
  { href: "/explore", label: "كل الأقسام", icon: Target },
  { href: "/rafiq", label: "رفيق AI", icon: Sparkles },
];

function Brand() {
  return <Link href="/" className="brand" aria-label="العودة إلى الرئيسية"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20"><polygon points="12,1 14.6,6.6 20.5,3.5 17.4,9.4 23,12 17.4,14.6 20.5,20.5 14.6,17.4 12,23 9.4,17.4 3.5,20.5 6.6,14.6 1,12 6.6,9.4 3.5,3.5 9.4,6.6" fill="currentColor" /></svg></span><span><b>مِيثَاق</b><small>رفقةٌ على هدي الوحي</small></span></Link>;
}

function Header({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const doLogout = async () => {
    setLoggingOut(true);
    try { await logout(); window.location.assign("/"); }
    catch { setLoggingOut(false); toast.error("تعذّر تسجيل الخروج. حاول مرة أخرى."); }
  };
  return <header className="site-header"><div className="header-inner"><Brand /><nav className="desktop-nav" aria-label="التنقل الرئيسي">{navItems.map(item => <Link key={item.href} href={item.href} className={location === item.href ? "active" : ""}>{item.label}</Link>)}</nav><div className="header-actions"><button className="icon-btn search-btn" aria-label="بحث (Ctrl+K)" onClick={onSearch}><Search size={19} /></button><button className="icon-btn" aria-label="تبديل الوضع الليلي" onClick={() => toggleTheme?.()}>{theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</button>{user ? <><Link href={user.role === "owner" ? "/owner" : user.role === "admin" ? "/dashboard" : "/login"} className="profile-chip"><UserRound size={17} /><span>{user.role === "owner" ? "لوحة المالك" : user.role === "admin" ? "لوحة الإدارة" : "حسابي"}</span></Link><button className="logout-btn" onClick={doLogout} disabled={loggingOut} aria-label="تسجيل الخروج"><LogOut size={17} /><span>{loggingOut ? "جارٍ الخروج…" : "تسجيل الخروج"}</span></button></> : <Link href="/login" className="login-link">تسجيل الدخول <ArrowLeft size={15} /></Link>}<button className="mobile-menu" onClick={onMenu} aria-label="فتح القائمة"><Menu size={21} /></button></div></div></header>;
}

function MobileMenu({ open, close }: { open: boolean; close: () => void }) {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  if (!open) return null;
  const doLogout = async () => { setLoggingOut(true); try { await logout(); window.location.assign("/"); } catch { setLoggingOut(false); toast.error("تعذّر تسجيل الخروج. حاول مرة أخرى."); } };
  return <div className="mobile-drawer"><div className="drawer-top"><Brand /><button className="icon-btn" onClick={close}><X size={20} /></button></div><div className="drawer-links">{navItems.map(item => <Link key={item.href} href={item.href} onClick={close}><item.icon size={18} />{item.label}<ArrowLeft size={15} /></Link>)}{user?.role === "owner" && <><Link href="/owner" onClick={close}><ShieldCheck size={18} />مركز المالك<ArrowLeft size={15} /></Link><Link href="/dashboard" onClick={close}><BookOpen size={18} />إدارة المحتوى<ArrowLeft size={15} /></Link><Link href="/permissions" onClick={close}><UserRound size={18} />الحسابات والصلاحيات<ArrowLeft size={15} /></Link></>}{user?.role === "admin" && <Link href="/dashboard" onClick={close}><UserRound size={18} />لوحة الإدارة<ArrowLeft size={15} /></Link>}<Link href="/privacy" onClick={close}><ShieldCheck size={18} />الأمانة والخصوصية<ArrowLeft size={15} /></Link></div>{user ? <button className="drawer-logout" onClick={doLogout} disabled={loggingOut}><LogOut size={18} />{loggingOut ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"}</button> : <Link href="/login" onClick={close} className="drawer-login">ابدأ بحسابك <ArrowLeft size={16} /></Link>}</div>;
}

function BottomNav() {
  const [location] = useLocation();
  const items = [{ href: "/", label: "الرئيسية", icon: HomeIcon }, { href: "/quran", label: "القرآن", icon: BookOpen }, { href: "/library", label: "المكتبة", icon: LibraryBig }, { href: "/explore", label: "الأقسام", icon: Compass }, { href: "/rafiq", label: "رفيق", icon: Sparkles }];
  return <nav className="bottom-nav" aria-label="تنقل سريع">{items.map(i => <Link key={i.href} href={i.href} className={location === i.href ? "active" : ""}><i.icon size={20} /><span>{i.label}</span></Link>)}</nav>;
}

function HomePage() {
  const [query, setQuery] = useState("");
  const [libraryTab, setLibraryTab] = useState("الكل");
  const latest = trpc.content.list.useQuery({ limit: 12 });
  const [last] = useState<{ id?: number; kind: string; title?: string; surah?: number; ayah?: number } | null>(() => { try { return JSON.parse(localStorage.getItem("lastRead") || "null"); } catch { return null; } });
  const filtered = useMemo(() => (latest.data ?? []).filter(m => (libraryTab === "الكل" || KINDS[m.kind as Kind].label === libraryTab) && `${m.title} ${m.category ?? ""}`.includes(query)).slice(0, 6), [latest.data, libraryTab, query]);
  return <>
    <div className="hero-bg" onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; e.currentTarget.style.setProperty("--px", String((x - 0.5) * 2)); e.currentTarget.style.setProperty("--py", String((y - 0.5) * 2)); e.currentTarget.style.setProperty("--sx", `${x * 100}%`); e.currentTarget.style.setProperty("--sy", `${y * 100}%`); }}><div className="hero-spot" /><section className="hero section-wrap"><div className="hero-copy"><div className="bsm-banner" role="img" aria-label="بسم الله الرحمن الرحيم">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div><div className="eyebrow"><span className="eyebrow-line" />مساحةٌ للقرآن والسنة والعبادة</div><h1>صحبةٌ مع الوحي،<br /><em>وأثرٌ في الحياة.</em></h1><p>من كتاب الله نبدأ، وعلى هدي رسوله ﷺ نتعلّم؛ تلاوةٌ وذكرٌ وصلاةٌ وأبوابٌ للعلم النافع، في رفقةٍ تعين على السكينة والعمل.</p><div className="hero-ctas"><Link href="/quran" className="primary-cta">ابدأ من القرآن <ArrowLeft size={18} /></Link><Link href="/explore" className="secondary-cta">تصفّح أبواب العبادة <ArrowUpLeft size={17} /></Link></div></div><div className="hero-art"><HeroArt /></div>
    </section></div>
    <section className="section-wrap start-section"><div className="section-heading"><div><span className="kicker">طريقك يبدأ هنا</span><h2>أبوابٌ تقرّبك من الخير</h2></div><p>ابدأ بالوحي، ثم اختر ما يعينك على العبادة والتعلّم.</p></div><div className="start-grid"><Link href="/quran" className="start-card featured"><div className="card-icon"><BookOpen size={23} /></div><div><span>تلاوةٌ وتدبّر</span><h3>القرآن الكريم</h3><p>المصحف كاملًا، مع بحث وقراءة على مهل.</p></div><ArrowLeft className="card-arrow" size={19} /></Link><Link href="/sunnah" className="start-card"><div className="card-icon"><Star size={22} /></div><div><span>هديٌ نبوي</span><h3>السنة النبوية</h3><p>تعلّم من أقوال النبي ﷺ وهديه.</p></div><ArrowLeft className="card-arrow" size={19} /></Link><Link href="/explore" className="start-card"><div className="card-icon"><Compass size={21} /></div><div><span>أبواب الخير</span><h3>كل الأقسام</h3><p>دليلٌ يجمع الوحي والعبادة والسيرة والتعلّم في مجموعات واضحة.</p></div><ArrowLeft className="card-arrow" size={19} /></Link></div></section>
    <RevelationSection />
    <TodayStrip />
    <section className="section-wrap atlas-section"><div className="section-heading"><div><span className="kicker">دليل مِيثَاق</span><h2>كل قسم في مكانه</h2></div><p>تصفّح المعرفة والعبادة والأدوات ضمن مجموعات سهلة.</p></div><Atlas /></section>
    {last && <section className="section-wrap continue-section"><div className="section-heading"><div><span className="kicker">مساحتك</span><h2>أكمل من حيث توقفت</h2></div></div><div className="continue-card"><div className="continue-icon"><BookOpen size={26} /></div><div className="continue-main"><div className="continue-top"><span>{KINDS[last.kind as Kind]?.label}</span></div><h3>{last.title || "موضع القراءة المحفوظ"}</h3></div><Link href={last.kind === "quran" && last.surah && last.ayah ? `/quran?surah=${last.surah}&ayah=${last.ayah}` : `${KINDS[last.kind as Kind]?.path}?open=${last.id ?? ""}`} className="continue-play"><Play size={17} fill="currentColor" /> متابعة القراءة</Link></div></section>}
    <section className="library-section"><div className="section-wrap"><div className="section-heading"><div><span className="kicker light">أحدث المواد</span><h2>زادٌ من الوحي والعلم النافع</h2></div><div className="library-search"><Search size={17} /><input aria-label="ابحث في المختارات" value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث في المختارات..." /></div></div><div className="library-tabs" role="tablist" aria-label="تصفية المختارات">{["الكل", ...Object.values(KINDS).map(k => k.label)].map(tab => <button key={tab} className={libraryTab === tab ? "active" : ""} onClick={() => setLibraryTab(tab)} role="tab" aria-selected={libraryTab === tab}>{tab}</button>)}</div><div className="library-grid">{filtered.map((m, i) => <article key={m.id} className={`library-card ${["sage", "gold", "ink"][i % 3]}`}><div className="library-card-top"><span>{KINDS[m.kind as Kind].label}</span></div><h3>{m.title}</h3><p>{m.category || ""}</p><Link href={`${KINDS[m.kind as Kind].path}?open=${m.id}`}><button>افتح المادة <ArrowLeft size={15} /></button></Link></article>)}{filtered.length === 0 && <p className="empty-state">{(latest.data ?? []).length === 0 ? "ستظهر هنا أحدث المواد المنشورة." : "لم نجد نتيجة. جرّب كلمة أخرى."}</p>}</div></div></section>
    <section className="section-wrap daily-section"><div className="daily-card"><div><span className="kicker">نافذة اليوم</span><h2>وَاذْكُرُوا اللَّهَ ذِكْرًا كَثِيرًا</h2><a className="verse-location" href="/quran?surah=33&ayah=41">اقرأ الآية كاملة في المصحف <ArrowLeft size={14} /></a><p>اجعل للذكر نصيبًا من يومك، وابدأ بما تطيق مع المواظبة والنية الصالحة.</p><Link href="/tasbih" className="secondary-cta light-cta">ابدأ الذكر <ArrowLeft size={17} /></Link></div><div className="moon-art"><Moon size={58} strokeWidth={1.3} aria-hidden="true" /><small>ورد يومي</small></div></div></section>
  </>;
}

function RevelationSection() {
  return <section className="section-wrap revelation-section" aria-label="آية وحديث موثقان">
    <div className="section-heading"><div><span className="kicker">من القرآن والسنة</span><h2>نصٌّ نتلوه، وهديٌ نتعلّمه</h2></div><p>آياتٌ نتلوها وأحاديث نتعلّم من هديها.</p></div>
    <div className="revelation-grid">
      <article className="revelation-card quran-card">
        <span className="revelation-label"><BookOpen size={17} /> من كتاب الله</span>
        <QuranPassages references={[{ title: "من سورة الشرح", surah: 94, ayah: 5 }, { title: "من سورة الشرح", surah: 94, ayah: 6 }]} compact />
      </article>
      <article className="revelation-card hadith-card">
        <span className="revelation-label"><Star size={17} /> من السنة النبوية</span>
        <blockquote lang="ar">إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى</blockquote>
      </article>
    </div>
  </section>;
}

function AboutPage() {
  return <main className="section-wrap section-page about-page">
    <div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} />عن مِيثَاق</div>
    <div className="page-hero"><div className="page-icon"><ShieldCheck size={28} /></div><span className="kicker">رسالتنا</span><h1>صحبةٌ مع الوحي، وأمانةٌ في العلم.</h1><p>مِيثَاق مساحةٌ تعين على تلاوة القرآن، وتعلّم هدي النبي ﷺ، والمواظبة على الذكر والصلاة وطلب العلم. نعامل الآية والحديث كأمانة، ونفصل النص المنقول عن الشرح، ونجعل مراجعة المادة شرطًا قبل نشرها.</p></div>
    <section className="about-principles" aria-label="مبادئ ميثاق">
      <article><span>١</span><div><h2>نتلو كتاب الله</h2><p>نفتح باب التلاوة والتدبّر، ونحرص على بقاء الآية في موضعها وسياقها.</p></div></article>
      <article><span>٢</span><div><h2>نتعلّم هدي رسوله ﷺ</h2><p>نتثبت من الروايات وننبّه إلى ما يحتاج مراجعةً من أهل الاختصاص.</p></div></article>
      <article><span>٣</span><div><h2>نحوّل المعرفة إلى عمل</h2><p>أدوات للذكر والصلاة والختمة، ومسارات للعلم؛ تعين على الخير ولا تستبدل سؤال أهل العلم.</p></div></article>
    </section>
    <div className="about-verse"><span className="kicker">دعاءٌ للعلم</span><p lang="ar">﴿ وَقُلْ رَبِّ زِدْنِي عِلْمًا ﴾</p><a href="/quran?surah=20&ayah=114">سورة طه، الآية ١١٤ · افتحها في المصحف <ArrowLeft size={15} /></a></div>
    <div className="about-cta"><div><h2>ابدأ من كتاب الله</h2><p>اختر بابًا للقراءة والذكر والتعلّم، وخذ من الخير ما ينفعك.</p></div><Link href="/quran" className="primary-cta">افتح القرآن الكريم <ArrowLeft size={17} /></Link></div>
  </main>;
}

const KIND_BY_PATH: Record<string, Kind> = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [v.path, k as Kind]));

function Dashboard() {
  const { user, loading } = useAuth();
  if (loading) return <main className="section-wrap dashboard-page"><div className="admin-loading">جارٍ التحقق من صلاحيات الحساب…</div></main>;
  if (!user) return <main className="section-wrap dashboard-page"><div className="access-card"><ShieldCheck size={34} /><span className="kicker">منطقة خاصة</span><h1>لوحة مِيثَاق</h1><p>سجّل الدخول بحسابك للوصول إلى إدارة المحتوى.</p><button className="primary-cta" onClick={() => startLogin()}>تسجيل الدخول <ArrowLeft size={17} /></button></div></main>;
  if (user.role !== "admin" && user.role !== "owner") return <main className="section-wrap dashboard-page"><div className="access-card"><ShieldCheck size={34} /><span className="kicker">صلاحية غير كافية</span><h1>هذه المساحة للمشرفين</h1><p>حسابك مسجل، لكن لا يملك صلاحية إدارة المحتوى. اطلب من مالك الموقع تفعيل الدور المناسب.</p><Link href="/" className="primary-cta">العودة للرئيسية <ArrowLeft size={17} /></Link></div></main>;
  return <main className="section-wrap dashboard-page admin-shell"><div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} />لوحة الإدارة</div><div className="dashboard-head"><div><span className="kicker">إدارة المحتوى</span><h1>لوحة مِيثَاق</h1><p>مرحبًا {user.name || "بك"} — من هنا تدير المواد المنشورة ومصادرها ومراجعتها.</p></div><div className="admin-badge"><ShieldCheck size={18} />{user.role === "owner" ? "مالك الموقع" : "مشرف محتوى"}</div></div>{user.role === "owner" && <div className="owner-page-shortcut"><Link href="/owner" className="detail-btn">العودة إلى لوحة المالك <ArrowLeft size={15} /></Link><Link href="/permissions" className="detail-btn">الحسابات والصلاحيات <UserRound size={15} /></Link></div>}<Suspense fallback={<div className="admin-loading">جارٍ التحميل…</div>}><AdminContent /></Suspense></main>;
}

function OwnerHome() {
  const { user, loading } = useAuth();
  const users = trpc.permissions.list.useQuery(undefined, { enabled: user?.role === "owner" });
  const stats = trpc.content.stats.useQuery(undefined, { enabled: user?.role === "owner" });
  if (loading) return <main className="section-wrap dashboard-page"><div className="admin-loading">جارٍ التحقق من صلاحيات المالك…</div></main>;
  if (!user) return <main className="section-wrap dashboard-page"><div className="access-card"><ShieldCheck size={34} /><span className="kicker">منطقة المالك</span><h1>لوحة المالك</h1><p>سجّل الدخول بحساب المالك لإدارة ميثاق.</p><Link href="/login" className="primary-cta">تسجيل الدخول <ArrowLeft size={17} /></Link></div></main>;
  if (user.role !== "owner") return <main className="section-wrap dashboard-page"><div className="access-card"><ShieldCheck size={34} /><span className="kicker">صفحة خاصة بالمالك</span><h1>هذه لوحة المالك</h1><p>حسابك لا يملك صلاحية إدارة إعدادات المنصة.</p><Link href="/" className="primary-cta">العودة للرئيسية <ArrowLeft size={17} /></Link></div></main>;
  const data = stats.data ?? { draft: 0, review: 0, published: 0 };
  return <main className="section-wrap dashboard-page owner-dashboard">
    <div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} />مركز المالك</div>
    <div className="dashboard-head"><div><span className="kicker">إدارة مِيثَاق</span><h1>لوحة المالك</h1><p>أهلًا {user.name || "بك"}، من هنا تصل إلى المحتوى والحسابات والصلاحيات.</p></div><div className="admin-badge"><ShieldCheck size={18} />مالك الموقع</div></div>
    <div className="owner-stat-grid">
      <article><span>حسابات المنصة</span><b>{users.data?.length ?? "—"}</b><small>أعضاء ومشرفون ومالك</small></article>
      <article><span>مواد منشورة</span><b>{data.published}</b><small>ظاهرة للزوار</small></article>
      <article><span>بانتظار المراجعة</span><b>{data.review}</b><small>تحتاج اعتماد المالك</small></article>
      <article><span>مسودات</span><b>{data.draft}</b><small>لا تظهر للعامة</small></article>
    </div>
    <section className="owner-control-section">
      <div className="section-heading"><div><span className="kicker">مفاتيح الإدارة</span><h2>تحكم في المحتوى والحسابات</h2></div><p>كل تغيير هنا مرتبط بصلاحيتك كمالك.</p></div>
      <div className="owner-control-grid">
        <Link href="/dashboard" className="owner-control-card"><span className="owner-control-icon"><BookOpen size={23} /></span><div><small>إضافة، مراجعة، نشر</small><h2>إدارة المحتوى</h2><p>أدر مواد القرآن والسنة والمكتبة والتعلّم والأذكار، وتحقق من صحة المادة قبل النشر.</p></div><ArrowLeft size={20} /></Link>
        <Link href="/permissions" className="owner-control-card"><span className="owner-control-icon"><UserRound size={23} /></span><div><small>الأعضاء والمشرفون</small><h2>الحسابات والصلاحيات</h2><p>استعرض الحسابات وامنح عضوًا صلاحية مشرف محتوى أو أعده إلى عضو.</p></div><ArrowLeft size={20} /></Link>
      </div>
    </section>
    <aside className="owner-security-note"><ShieldCheck size={19} /><p><b>إعدادات التشغيل محفوظة بأمان.</b> مفاتيح Google ورفيق الذكاء الاصطناعي ورابط قاعدة البيانات تُضبط في ملف <code>.env</code> أو إعدادات الاستضافة، ولا نعرضها داخل لوحة الموقع.</p></aside>
  </main>;
}

function PermissionsPage() {
  const { user, loading } = useAuth();
  const users = trpc.permissions.list.useQuery(undefined, { enabled: user?.role === "owner" });
  const utils = trpc.useUtils();
  const updateRole = trpc.permissions.updateRole.useMutation({ onSuccess: () => utils.permissions.list.invalidate() });
  if (loading) return <main className="section-wrap dashboard-page"><div className="admin-loading">جارٍ التحقق من الحساب…</div></main>;
  if (!user) return <main className="section-wrap dashboard-page"><div className="access-card"><ShieldCheck size={34} /><span className="kicker">منطقة المالك</span><h1>إدارة الصلاحيات</h1><p>سجّل الدخول بالبريد الإلكتروني المحدد لحساب المالك.</p><Link href="/login" className="primary-cta">تسجيل الدخول <ArrowLeft size={17} /></Link></div></main>;
  if (user.role !== "owner") return <main className="section-wrap dashboard-page"><div className="access-card"><ShieldCheck size={34} /><span className="kicker">صفحة خاصة بالمالك</span><h1>لا تملك صلاحية إدارة الحسابات</h1><p>يمكن لمالك الموقع وحده تغيير أدوار الحسابات.</p><Link href="/" className="primary-cta">العودة للرئيسية <ArrowLeft size={17} /></Link></div></main>;
  return <main className="section-wrap dashboard-page permissions-page"><div className="page-crumb"><Link href="/owner">لوحة المالك</Link><ArrowLeft size={14} />إدارة الصلاحيات</div><div className="dashboard-head"><div><span className="kicker">إعدادات المالك</span><h1>الحسابات والصلاحيات</h1><p>امنح المشرفين صلاحية إدارة المحتوى. لا يمكن تغيير دور المالك من هذه الصفحة.</p></div><div className="admin-badge"><ShieldCheck size={18} />مالك الموقع</div></div>
    <div className="owner-page-shortcut"><Link href="/dashboard" className="detail-btn">إدارة المحتوى <BookOpen size={15} /></Link></div>{users.isLoading ? <div className="admin-loading">جارٍ تحميل الحسابات…</div> : users.error ? <div className="access-card"><p role="alert">تعذّر تحميل الحسابات. حدّث الصفحة وحاول مرة أخرى.</p></div> : <div className="permissions-table-wrap"><table className="permissions-table"><thead><tr><th>الحساب</th><th>البريد الإلكتروني</th><th>تاريخ الإنشاء</th><th>الصلاحية</th></tr></thead><tbody>{users.data?.map(account => <tr key={account.id}><td>{account.name || "—"}</td><td dir="ltr">{account.email || "—"}</td><td>{new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(account.createdAt)}</td><td>{account.role === "owner" ? <span className="role-badge owner">مالك الموقع</span> : <select aria-label={`صلاحية ${account.email || account.name || account.id}`} value={account.role} disabled={updateRole.isPending} onChange={event => updateRole.mutate({ id: account.id, role: event.target.value as "user" | "admin" })}><option value="user">عضو</option><option value="admin">مشرف محتوى</option></select>}</td></tr>)}</tbody></table>{updateRole.error && <p className="permissions-error" role="alert">{updateRole.error.message}</p>}</div>}
  </main>;
}

function RafiqPage() {
  const { user, loading } = useAuth();
  const chat = trpc.rafiq.chat.useMutation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/rafiq/status", { cache: "no-store" })
      .then(response => response.ok ? response.json() as Promise<{ enabled?: boolean }> : null)
      .then(status => setAiConfigured(status?.enabled === true))
      .catch(() => setAiConfigured(false));
  }, []);
  const send = (content: string) => {
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    const apiMessages = next.filter(message => message.role === "user" || message.role === "assistant").map(message => ({ role: message.role === "user" ? "user" as const : "assistant" as const, content: message.content }));
    chat.mutate({ messages: apiMessages }, { onSuccess: result => setMessages(current => [...current, { role: "assistant", content: `${result.answer}\n\n— ${result.notice}` }]), onError: error => setMessages(current => [...current, { role: "assistant", content: error.message.includes("إعداد رفيق ناقص") || error.message.includes("OPENAI_API_KEY") || error.message.includes("OPENAI_MODEL") ? "رفيق غير مفعّل بعد. أضف مفتاح مزود الذكاء الاصطناعي واسم النموذج إلى ملف .env على جهازك، ثم أعد تشغيل الموقع. لا ترسل المفتاح هنا." : "تعذر الاتصال برفيق الآن. لا تعتمد على إجابة دينية قبل مراجعتها مع أهل العلم، وحاول مرة أخرى لاحقًا." }]) });
  };
  if (loading) return <main className="section-wrap rafiq-page"><div className="admin-loading">جارٍ التحقق من الحساب…</div></main>;
  if (!user) return <main className="section-wrap rafiq-page"><div className="access-card"><Sparkles size={34} /><span className="kicker">للمسجلين فقط</span><h1>رفيق AI</h1><p>رفيق متاح للأعضاء المسجلين فقط. أنشئ حسابك مجانًا أو سجّل الدخول لتبدأ.</p><Link href="/login" className="primary-cta">تسجيل الدخول <ArrowLeft size={17} /></Link></div></main>;
  return <main className="section-wrap rafiq-page"><div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} />رفيق AI</div><div className="rafiq-layout"><aside className="rafiq-aside"><div className="rafiq-orb"><Sparkles size={27} /></div><span className="kicker">رفيق AI</span><h1>اسأل طلبًا للفهم، واتبع أهل العلم فيما أشكل.</h1><p>مساعد للفهم وصياغة أسئلة البحث داخل مِيثَاق. لا يبحث حاليًا في مواد الموقع، ولا يصدر فتاوى.</p><div className="rafiq-rules"><div><ShieldCheck size={16} /><span><b>راجع المسائل الشرعية</b><small>لا يدّعي بحثًا لم يحدث.</small></span></div><div><CircleHelp size={16} /><span><b>ليس مفتيًا</b><small>المسائل الخاصة لأهل الاختصاص.</small></span></div><div><Check size={16} /><span><b>لغة واضحة</b><small>يفصل النص عن الشرح.</small></span></div></div></aside><section className="rafiq-chat"><div className="chat-heading"><div><span className="kicker">مساحة السؤال</span><h2>ماذا تريد أن تفهم؟</h2></div><span className={`verified-pill ${aiConfigured === false ? "is-unavailable" : ""}`}><ShieldCheck size={14} />{aiConfigured === null ? "جارٍ التحقق من الإعداد" : aiConfigured ? "رفيق متصل" : "رفيق غير مفعّل"}</span></div>{aiConfigured === false ? <div className="rafiq-unavailable"><Sparkles size={28} /><h3>رفيق ينتظر ربط مزوّد الذكاء الاصطناعي</h3><p>أضف <code>OPENAI_API_KEY</code> و<code>OPENAI_MODEL</code> في ملف <code>.env</code> على جهازك، ثم أعد تشغيل الموقع. لا تضع المفتاح في الواجهة أو المحادثة.</p></div> : aiConfigured === null ? <div className="admin-loading" role="status">جارٍ التحقق من إعداد رفيق…</div> : <Suspense fallback={<div className="admin-loading" role="status">جارٍ تجهيز مساحة المحادثة…</div>}><AIChatBox messages={messages} onSendMessage={send} isLoading={chat.isPending} height="510px" emptyStateMessage="ابدأ بسؤال، وسأوضح حدود الإجابة وما يحتاج إلى مراجعة." placeholder="اسأل عن مفهوم، أو طريقة بحث…" suggestedPrompts={["كيف أبدأ تدبر القرآن؟", "ما الفرق بين النص والشرح؟", "كيف أتحقق من حديث منسوب؟"]} /></Suspense>}</section></div></main>;
}

function TasbihPage() {
  const [count, setCount] = useState(() => { try { return Number(localStorage.getItem("tasbih") || 0); } catch { return 0; } });
  const [goal, setGoal] = useState(33);
  const bump = (n: number) => { const v = Math.max(0, n); setCount(v); try { localStorage.setItem("tasbih", String(v)); } catch {} if (v > 0 && v % goal === 0) navigator.vibrate?.(60); };
  return <main className="section-wrap section-page"><div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} />السبحة</div><Hero icon={RotateCcw} k="ذكرٌ يومي" t="اذكر الله بقلب حاضر." p="عداد بسيط يعينك على متابعة وردك، والذكر عبادةٌ باللسان والقلب لا بالأرقام وحدها." /><QuranQuote surah={33} ayah={41} /><div className="tasbih-card"><span className="kicker">وردك على هذا الجهاز</span><h1>سبّح بقلبك، وعُدّ بيدك.</h1><button className="tasbih-btn" onClick={() => bump(count + 1)} aria-label="زيادة العدّاد"><b>{count}</b><small>اضغط للعدّ</small></button><div className="progress-line"><i style={{ width: `${((count % goal) / goal) * 100}%` }} /></div><div className="tasbih-tools">{[33, 100, 1000].map(g => <button key={g} className={goal === g ? "active" : ""} onClick={() => setGoal(g)}>الهدف {g}</button>)}<button onClick={() => bump(0)}><RotateCcw size={14} /> تصفير</button></div><small className="tasbih-note">العداد تذكيرٌ لك، ولا يحدد العدد المشروع في الذكر.</small></div></main>;
}

function PrivacyPage() { return <main className="section-wrap section-page"><div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} />الأمانة والخصوصية</div><div className="page-hero"><div className="page-icon"><ShieldCheck size={28} /></div><span className="kicker">ميثاقنا معك</span><h1>الأمانة قبل كل شيء</h1><p>نوضح ما تجمعه المنصة، وما تنشره، وما لا نعرفه. نراجع المحتوى الشرعي قبل نشره، وبياناتك الخاصة لا تُعرض للعامة.</p></div><div className="coming-panel privacy-panel"><h2>مبادئ واضحة</h2><div className="privacy-list"><div><b>المحتوى</b><span>لا تظهر المواد غير المعتمدة في نتائج الجمهور.</span></div><div><b>بيانات الحساب</b><span>نحفظ البريد والصلاحية في قاعدة الموقع، وكلمة المرور محفوظة كبصمة لا يمكن استرجاعها مباشرة. المفضلة وموضع القراءة محفوظان محليًا على الجهاز حاليًا.</span></div><div><b>الذكاء الاصطناعي</b><span>لا يصدر رفيق فتاوى ولا ينسب قولًا شرعيًا دون تثبّت. عند تشغيله، تُرسل الأسئلة إلى مزود الذكاء الاصطناعي الذي تضبطه.</span></div><div><b>التصحيح</b><span>تُراجع النصوص المنشورة، ويمكن للمالك تعديلها أو إيقافها عند الحاجة.</span></div></div></div></main>; }

export default function Home() {
  const [location] = useLocation(); useFx();
  const [menu, setMenu] = useState(false); const [searching, setSearching] = useState(false);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearching(true); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [location]);
  const page = <>{location === "/" ? <HomePage /> : location === "/about" ? <AboutPage /> : location === "/owner" ? <OwnerHome /> : location === "/dashboard" ? <Dashboard /> : location === "/permissions" ? <PermissionsPage /> : location === "/rafiq" ? <RafiqPage /> : location === "/privacy" ? <PrivacyPage /> : location === "/tasbih" ? <TasbihPage /> : location === "/tools" ? <ToolsHub /> : location === "/prayer" ? <PrayerPage /> : location === "/khatma" ? <KhatmaPage /> : location === "/zakat" ? <ZakatPage /> : isExplore(location) ? <ExplorePage path={location} /> : KIND_BY_PATH[location] ? <ContentPage kind={KIND_BY_PATH[location]} /> : <HomePage />}</>;
  return <div dir="rtl" className="meethaq-app"><Header onMenu={() => setMenu(true)} onSearch={() => setSearching(true)} /><SearchPalette open={searching} close={() => setSearching(false)} /><MobileMenu open={menu} close={() => setMenu(false)} />{page}<BottomNav /><footer className="site-footer"><div className="section-wrap footer-inner"><Brand /><p>تلاوةٌ، وذكرٌ، وعلمٌ يُطلب بأمانة.<br />نحرص على صحة النص ونميّز الوحي من الشرح.</p><div className="footer-links"><Link href="/privacy">الأمانة والخصوصية</Link><Link href="/owner">لوحة المالك</Link><Link href="/about">عن ميثاق</Link><Link href="/login">تسجيل الدخول</Link></div><span className="copyright">© ٢٠٢٦ مِيثَاق</span></div></footer></div>;
}
