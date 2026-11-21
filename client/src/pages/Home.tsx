import { lazy, Suspense, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { startLogin } from "@/const";
import { RAFIQ_MESSAGE_LENGTH, RAFIQ_MESSAGE_LIMIT } from "@shared/const";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import type { Message as ChatMessage } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import ContentPage, { KINDS, type Kind } from "@/components/ContentPage";
import useGlassLight from "@/hooks/useGlassLight";
import GlassHeading from "@/components/GlassHeading";
import MithaqBrand from "@/components/MithaqBrand";
import { MithaqMobileLinks, MithaqSidebar, ReferenceHeader } from "@/components/ReferenceHome";
import DailyHome from "@/components/DailyHome";
import QuranReader from "@/components/QuranReader";
import Login from "@/pages/Login";
import TasbihPage from "@/components/TasbihPage";
import ReminderSettings from "@/components/ReminderSettings";
import PersonalDashboard from "@/components/PersonalDashboard";
import MotionLink from "@/components/MotionLink";
import { sectionForPath, sections } from "@/lib/sections";
import SearchPalette from "@/components/SearchPalette";
import { ExplorePage, isExplore } from "@/components/Explore";
import { ToolsHub, PrayerPage, KhatmaPage, ZakatPage } from "@/components/Tools";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Bell, BookOpen, Clock, LayoutDashboard,
  Heart, Moon, ShieldCheck, Sparkles, Target,
  UserRound, X, Sun, LogOut
} from "lucide-react";

const AIChatBox = lazy(() => import("@/components/AIChatBox").then(module => ({ default: module.AIChatBox })));
const AdminContent = lazy(() => import("@/components/AdminContent"));

function Header({ onMenu, onSearch, menuOpen, searchOpen }: { onMenu: () => void; onSearch: () => void; menuOpen: boolean; searchOpen: boolean }) {
  const [location] = useLocation();
  const accountMenu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = accountMenu.current;
    if (typeof panel?.hidePopover === "function" && panel.matches(":popover-open")) panel.hidePopover();
  }, [location, menuOpen, searchOpen]);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const doLogout = async () => {
    setLoggingOut(true);
    try { await logout(); window.location.assign("/"); }
    catch { setLoggingOut(false); toast.error("تعذّر تسجيل الخروج. حاول مرة أخرى."); }
  };
  return <ReferenceHeader onMenu={onMenu} menuOpen={menuOpen} onSearch={onSearch} account={
    <>
      <button type="button" className="reference-avatar" popoverTarget="mithaq-account-menu" aria-label="الحساب والتفضيلات">
        <UserRound size={22} aria-hidden="true" />
      </button>
      <div id="mithaq-account-menu" ref={accountMenu} className="reference-account-menu" popover="auto" dir="rtl">
        <Link href="/my-day"><LayoutDashboard size={17} />متابعتي</Link>
        <Link href="/explore"><Target size={17} />استكشف ميثاق</Link>
        <button type="button" onClick={toggleTheme}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />} تبديل المظهر</button>
        {user ? <>
          {user.role !== "user" && <Link href={user.role === "owner" ? "/owner" : "/dashboard"}><ShieldCheck size={17} />{user.role === "owner" ? "لوحة المالك" : "لوحة الإدارة"}</Link>}
          <button type="button" onClick={doLogout} disabled={loggingOut}><LogOut size={17} />{loggingOut ? "جارٍ الخروج…" : "تسجيل الخروج"}</button>
        </> : <Link href="/login"><UserRound size={17} />تسجيل الدخول</Link>}
      </div>
    </>
  } />;

}

function MobileMenu({ open, close }: { open: boolean; close: () => void }) {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [open, close]);
  if (!open) return null;
  const doLogout = async () => { setLoggingOut(true); try { await logout(); window.location.assign("/"); } catch { setLoggingOut(false); toast.error("تعذّر تسجيل الخروج. حاول مرة أخرى."); } };
  return <div className="mobile-drawer" id="launch-mobile-menu"><div className="drawer-top"><MithaqBrand onNavigate={close} /><button className="icon-btn" aria-label="إغلاق القائمة" onClick={close}><X size={20} /></button></div><div className="drawer-links"><MithaqMobileLinks onNavigate={close} />{user?.role === "owner" && <><Link href="/owner" onClick={close}><ShieldCheck size={18} />مركز المالك<ArrowLeft size={15} /></Link><Link href="/dashboard" onClick={close}><BookOpen size={18} />إدارة المحتوى<ArrowLeft size={15} /></Link><Link href="/permissions" onClick={close}><UserRound size={18} />الحسابات والصلاحيات<ArrowLeft size={15} /></Link></>}{user?.role === "admin" && <Link href="/dashboard" onClick={close}><UserRound size={18} />لوحة الإدارة<ArrowLeft size={15} /></Link>}<Link href="/privacy" onClick={close}><ShieldCheck size={18} />الأمانة والخصوصية<ArrowLeft size={15} /></Link></div>{user ? <button className="drawer-logout" onClick={doLogout} disabled={loggingOut}><LogOut size={18} />{loggingOut ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"}</button> : <Link href="/login" onClick={close} className="drawer-login">ابدأ بحسابك <ArrowLeft size={16} /></Link>}</div>;
}

function BottomNav() {
  const [location] = useLocation();
  const group = sectionForPath(location, useSearch());
  const links = [...sections.slice(0, 2), { id: "prayer", href: "/prayer", label: "الصلاة", icon: Clock }, ...sections.slice(2)];
  return <nav className="bottom-nav" aria-label="تنقل سريع">{links.map(item => {
    const active = location === "/prayer" ? item.id === "prayer" : group?.id === item.id;
    return <MotionLink key={item.href} href={item.href} aria-current={location === item.href ? "page" : active ? "location" : undefined} className={active ? "active" : ""}><item.icon size={20} /><span>{item.label}</span></MotionLink>;
  })}</nav>;
}

function AboutPage() {
  return <main className="section-wrap section-page about-page">
    <div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} />عن مِيثَاق</div>
    <GlassHeading className="glass-about-heading" icon={BookOpen} label="عن مِيثَاق" title="صحبةٌ مع الوحي، وأمانةٌ في العلم"
      description="مساحة لتلاوة القرآن، وتعلّم هدي النبي ﷺ، والمواظبة على الذكر والصلاة. نفصل النص المنقول عن الشرح ونراجع المادة قبل نشرها."
      action={<Link href="/quran" className="primary-cta">افتح المصحف <ArrowLeft size={16} /></Link>} />
    <section className="about-principles" aria-label="مبادئ ميثاق">
      <article><span><BookOpen size={18} aria-hidden="true" /></span><div><h2>نتلو كتاب الله</h2><p>نفتح باب التلاوة والتدبّر، ونحرص على بقاء الآية في موضعها وسياقها.</p></div></article>
      <article><span><ShieldCheck size={18} aria-hidden="true" /></span><div><h2>نتعلّم هدي رسوله ﷺ</h2><p>نتثبت من الروايات وننبّه إلى ما يحتاج مراجعةً من أهل الاختصاص.</p></div></article>
      <article><span><Heart size={18} aria-hidden="true" /></span><div><h2>نحوّل المعرفة إلى عمل</h2><p>أدوات للذكر والصلاة والختمة، ومسارات للعلم؛ تعين على الخير ولا تستبدل سؤال أهل العلم.</p></div></article>
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
  const data = stats.data;
  const count = new Intl.NumberFormat("ar-EG");
  return <main className="section-wrap dashboard-page owner-dashboard">
    <div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} />مركز المالك</div>
    <GlassHeading icon={ShieldCheck} label="إدارة مِيثَاق" title="لوحة المالك"
      description={`أهلًا ${user.name || "بك"}، من هنا تدير المحتوى والحسابات.`}
      action={<Link href="/dashboard" className="primary-cta">إدارة المحتوى <ArrowLeft size={16} /></Link>} />
    <div className="owner-stat-grid">
      <article><span>حسابات المنصة</span><b>{users.data ? count.format(users.data.length) : "—"}</b><small>أعضاء ومشرفون ومالك</small></article>
      <article><span>مواد منشورة</span><b>{data ? count.format(data.published) : "—"}</b><small>ظاهرة للزوار</small></article>
      <article><span>بانتظار المراجعة</span><b>{data ? count.format(data.review) : "—"}</b><small>تحتاج اعتماد المالك</small></article>
      <article><span>مسودات</span><b>{data ? count.format(data.draft) : "—"}</b><small>لا تظهر للعامة</small></article>
    </div>
    {(stats.isError || users.isError) && <p className="reminder-note" role="alert">تعذّر تحميل بعض الإحصاءات.</p>}
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
  const topic = new URLSearchParams(useSearch()).get("seerah")?.trim().slice(0, 110);
  const starter = topic ? `أريد أن أفهم هذا الموضوع من السيرة النبوية: ${topic}` : undefined;
  const chat = trpc.rafiq.chat.useMutation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const history = useRef<ChatMessage[]>([]);
  const lastQuestion = useRef<ChatMessage | null>(null);
  const requestInProgress = useRef(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/rafiq/status", { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<{ enabled?: boolean }> : null)
      .then(status => { if (!controller.signal.aborted) setAiConfigured(status?.enabled === true); })
      .catch(() => { if (!controller.signal.aborted) setAiConfigured(false); });
    return () => controller.abort();
  }, []);

  const ask = (question: ChatMessage) => {
    if (requestInProgress.current) return;
    requestInProgress.current = true;
    const previous = history.current.slice(1 - RAFIQ_MESSAGE_LIMIT);
    if (previous[0]?.role === "assistant") previous.shift();
    const next = [...previous, question];
    chat.mutate({ messages: next.map(({ role, content }) => ({ role, content })) }, {
      onSuccess: result => {
        history.current = [...next, { role: "assistant", content: result.answer.slice(0, RAFIQ_MESSAGE_LENGTH) }];
        setMessages(current => [...current, { role: "assistant", content: result.answer, sources: result.sources }]);
      },
      onSettled: () => { requestInProgress.current = false; },
    });
  };
  const send = (content: string) => {
    if (requestInProgress.current) return;
    const question = { role: "user" as const, content };
    lastQuestion.current = question;
    setMessages(current => [...current, question]);
    ask(question);
  };
  const error = chat.error
    ? chat.error.data?.code === "SERVICE_UNAVAILABLE" ? chat.error.message : "تعذّر إكمال السؤال. حاول مرة أخرى."
    : null;

  if (loading) return <main className="section-wrap rafiq-page"><div className="admin-loading">جارٍ التحقق من الحساب…</div></main>;
  if (!user) return <main className="section-wrap rafiq-page">
    <div className="access-card"><Sparkles size={34} /><h1>رفيق</h1><p>سجّل الدخول لتبدأ المحادثة.</p>
      <Link href="/login" className="primary-cta">تسجيل الدخول <ArrowLeft size={17} /></Link>
    </div>
  </main>;

  return <main className="section-wrap rafiq-page rafiq-shell" dir="rtl">
    <div className="page-crumb"><Link href="/">الرئيسية</Link><ArrowLeft size={14} />رفيق</div>
    <section className="rafiq-panel" aria-label="محادثة رفيق">
      <header className="rafiq-panel-header">
        <div className="rafiq-brand-icon"><Sparkles size={22} aria-hidden="true" /></div>
        <div><h1>رفيق</h1><p>مساعد للأسئلة والتعلّم. قد يخطئ، والمسائل الخاصة تُراجع مع أهل الاختصاص.</p></div>
      </header>
      {aiConfigured === false
        ? <p className="rafiq-panel-state" role="status">رفيق غير متاح حاليًا. حاول مرة أخرى لاحقًا.</p>
        : aiConfigured === null
          ? <p className="rafiq-panel-state" role="status">جارٍ التحقق من توفر رفيق…</p>
          : <Suspense fallback={<p className="rafiq-panel-state" role="status">جارٍ تجهيز المحادثة…</p>}>
            <AIChatBox key={topic} initialQuestion={starter} messages={messages} onSendMessage={send}
              onRetry={() => { if (lastQuestion.current) ask(lastQuestion.current); }}
              isLoading={chat.isPending} error={error} />
          </Suspense>}
    </section>
  </main>;
}

function PrivacyPage() {
  const topics = [
    ["المحتوى", "لا تظهر المواد غير المعتمدة في نتائج الجمهور."],
    ["الحساب", "نحفظ البريد والصلاحية في قاعدة الموقع. إذا سجّلت بكلمة مرور، نحتفظ ببصمتها ولا نخزّن الكلمة نفسها."],
    ["التقدم والمزامنة", "يظل التقدم محفوظًا محليًا، وتُزامن عناصر محددة للحساب عند تسجيل الدخول والاتصال: موضع القراءة والمفضلة والختمة وسجل الصلاة وجلسات الأذكار والسبحة. عند أول تسجيل دخول تُضم بيانات التقدم الموجودة على الجهاز إلى الحساب؛ وعند تبديل الحساب تُعزل بيانات كل حساب. لا تُزامن المدينة أو إعدادات الجهاز أو رموز وإعدادات Web Push. عند تعارض قيمة واحدة يفوز آخر تحديث زمني."],
    ["التنبيهات والموقع", "عند التفعيل، نحفظ اشتراك الجهاز وجدوله. تُرسل إحداثيات المدينة أو موقع تقريبي للتنبيهات المرتبطة بالموقع. يمكنك إيقاف التنبيهات من الإعدادات لحذف الاشتراك من الخادم."],
    ["رفيق", "تُرسل الأسئلة إلى مزوّد الذكاء الاصطناعي عند استخدام رفيق، وقد تُرسل صيغة البحث إلى مزوّد البحث الخارجي إن كان مفعّلًا."],
    ["قراءة المصحف", "خطوط الواجهة محفوظة داخل مِيثَاق. يستعلم قارئ المصحف من خدمة Al Quran Cloud عن القرّاء والتفسير والتلاوة. تتصل التلاوة بخادم الصوت عند تشغيلها."],
    ["الفيديو والدورات الخارجية", "يتّصل مشغّل يوتيوب بخدمة يوتيوب عند الضغط على زر مشاهدة الحلقة. تفتح روابط الدورات منصّات الناشرين وتخضع لاشتراطات تلك المنصّات."],
    ["تصحيح المحتوى", "تُراجع النصوص المنشورة، ويمكن للمالك تعديلها أو إيقاف نشرها عند الحاجة."],
  ];
  return <main className="section-wrap section-page glass-privacy">
    <GlassHeading icon={ShieldCheck} label="مِيثَاق" title="الأمانة والخصوصية"
      description="ما يُحفظ على جهازك، وما يرسله مِيثَاق عند استخدام الحساب أو التنبيهات أو رفيق."
      action={<Link href="/settings" className="detail-btn">إعدادات التنبيهات <ArrowLeft size={16} /></Link>} />
    <dl className="glass-privacy-grid">{topics.map(([title, body]) => <div key={title}><dt>{title}</dt><dd>{body}</dd></div>)}</dl>
  </main>;
}

const routePages = {
  "/": DailyHome,
  "/my-day": PersonalDashboard,
  "/settings": ReminderSettings,
  "/about": AboutPage,
  "/owner": OwnerHome,
  "/dashboard": Dashboard,
  "/permissions": PermissionsPage,
  "/rafiq": RafiqPage,
  "/privacy": PrivacyPage,
  "/tasbih": TasbihPage,
  "/tools": ToolsHub,
  "/prayer": PrayerPage,
  "/khatma": KhatmaPage,
  "/zakat": ZakatPage,
  "/login": Login,
} as const;

export function isSitePath(path: string) {
  return Object.hasOwn(routePages, path) || Object.hasOwn(KIND_BY_PATH, path) || isExplore(path);
}

export default function Home() {
  const shell = useRef<HTMLDivElement>(null);
  useGlassLight(shell);
  const [location] = useLocation();
  const { user } = useAuth();
  const [menu, setMenu] = useState(false); const [searching, setSearching] = useState(false);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearching(true); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const search = useSearch();
  useEffect(() => {
    const anchor = window.location.hash.slice(1);
    if (anchor === "qibla" || anchor === "adhan" || anchor === "salah-log" || anchor === "my-journey") {
      const frame = requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: "start" }));
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo({ top: 0 });
  }, [location, search]);
  const Page = routePages[location as keyof typeof routePages];
  const readerActive = location === "/quran";
  const [readerVisited, setReaderVisited] = useState(readerActive);
  useEffect(() => { if (readerActive) setReaderVisited(true); setMenu(false); }, [location, readerActive]);
  const page = Page ? <Page /> : isExplore(location) ? <ExplorePage path={location} /> : <ContentPage kind={KIND_BY_PATH[location]} omitReader={readerActive} />;
  return <div ref={shell} dir="rtl" className={`meethaq-app launch-shell launch-clean atmosphere-shell reference-shell${location === "/" ? "" : " mithaq-inner-shell"}`}>
    <Header menuOpen={menu} searchOpen={searching} onMenu={() => setMenu(open => !open)} onSearch={() => { setMenu(false); setSearching(true); }} />
    <SearchPalette open={searching} close={() => setSearching(false)} />
    <MobileMenu open={menu} close={() => setMenu(false)} />
  <div className="launch-route">
      <div className="reference-home mithaq-inner-frame" hidden={location === "/"}>
        <div className="mithaq-inner-content">
          {(readerVisited || readerActive) && <main className="section-wrap section-page quran-mushaf-page" hidden={!readerActive}><QuranReader active={readerActive} /></main>}
          {location !== "/" && <div key={location}>{page}</div>}
        </div>
        <MithaqSidebar />
      </div>
      {location === "/" && page}
    </div>
    <BottomNav />
    <footer className="site-footer">
      <div className="section-wrap footer-inner">
        <Link href="/" className="footer-name">مِيثَاق</Link>
        <nav className="footer-links" aria-label="روابط التذييل">
          <Link href="/about">عن مِيثَاق</Link><Link href="/privacy">الخصوصية</Link><Link href="/settings">الإعدادات</Link>
          {user?.role === "owner" && <Link href="/owner">لوحة المالك</Link>}
          {!user && <Link href="/login">تسجيل الدخول</Link>}
        </nav>
        <span className="copyright">© {new Date().getFullYear().toLocaleString("ar-EG", { useGrouping: false })} مِيثَاق</span>
      </div>
    </footer>
  </div>;
}
