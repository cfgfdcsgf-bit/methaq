import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BookOpen, Compass, Eye, EyeOff, LibraryBig, ShieldCheck, Sparkles, Star, RotateCcw } from "lucide-react";

const features = [
  { icon: BookOpen, title: "القرآن الكريم", copy: "قراءة هادئة، وحفظ موضعك، ومتابعة تقدمك." },
  { icon: Star, title: "السنة والأذكار", copy: "نصوص مرتبة تساعدك على القراءة والبحث." },
  { icon: LibraryBig, title: "المكتبة الإسلامية", copy: "تفسير وسيرة وعلوم، قابلة للبحث والتصفية." },
  { icon: Compass, title: "مسارات التعلّم", copy: "دروس قصيرة للكبار والصغار، مع تقدم واختبارات." },
  { icon: Sparkles, title: "رفيق AI", copy: "مساعد للبحث والتعلّم؛ راجع النصوص الشرعية في مصادرها ولا تعتمد عليه كجهة إفتاء." },
  { icon: RotateCcw, title: "السبحة والورد", copy: "عدّاد ذكر وورد يومي يناسب وقتك." },
];

/** tRPC returns zod failures as a JSON array in `message`; show the Arabic rules, not raw JSON. */
function readableError(cause: unknown) {
  const raw = cause instanceof Error ? cause.message : "";
  if (!raw) return "تعذّر إتمام العملية. حاول مرة أخرى.";
  try {
    const issues = JSON.parse(raw);
    if (Array.isArray(issues)) {
      const messages = [...new Set(issues.map((issue: { message?: string }) => issue?.message).filter(Boolean))];
      if (messages.length) return messages.join(" · ");
    }
  } catch { /* not JSON: a plain server message */ }
  return raw;
}

export default function Login() {
  const { user, loading, logout } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleStatusReady, setGoogleStatusReady] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const utils = trpc.useUtils();
  const login = trpc.auth.localLogin.useMutation();
  const register = trpc.auth.localRegister.useMutation();
  const resendVerification = trpc.auth.resendVerification.useMutation();
  const requestPasswordReset = trpc.auth.requestPasswordReset.useMutation();
  const pending = login.isPending || register.isPending || resendVerification.isPending || requestPasswordReset.isPending;
  const passwordRules = [
    { label: "8 أحرف على الأقل", valid: password.length >= 8 },
    { label: "4 محارف مختلفة على الأقل", valid: new Set(password).size >= 4 },
  ];

  useEffect(() => {
    fetch("/api/auth/google/status")
      .then(response => response.ok ? response.json() as Promise<{ enabled?: boolean }> : null)
      .then(status => setGoogleEnabled(status?.enabled === true))
      .catch(() => setGoogleEnabled(false))
      .finally(() => setGoogleStatusReady(true));
    fetch("/api/auth/features")
      .then(response => response.ok ? response.json() as Promise<{ email?: boolean }> : null)
      .then(status => setEmailEnabled(status?.email === true))
      .catch(() => setEmailEnabled(false));

    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_error") === "google") {
      setError("تعذّر إكمال تسجيل الدخول عبر Google. جرّب مرة أخرى أو استخدم البريد الإلكتروني.");
      params.delete("auth_error");
      window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    }
  }, []);

  const finish = async (role: string) => {
    await utils.auth.me.invalidate();
    window.location.assign(role === "owner" ? "/owner" : "/");
  };

  const continueWithGoogle = () => {
    setError("");
    window.location.assign("/api/auth/google/start");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setCanResend(false);
    if (mode === "register" && password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    try {
      if (mode === "login") {
        const result = await login.mutateAsync({ email, password });
        await finish(result.role);
        return;
      }
      const result = await register.mutateAsync({ name, email, password });
      if (result.verificationRequired) {
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setCanResend(!result.emailSent);
        setSuccessMessage(result.emailSent ? "أنشأنا حسابك وأرسلنا رابط تأكيد إلى بريدك. افتح الرابط قبل تسجيل الدخول." : "أنشأنا حسابك، لكن تعذّر إرسال رسالة التفعيل. يمكنك طلب إعادة الإرسال من هنا لاحقًا.");
        return;
      }
      await finish(result.role);
    } catch (cause) {
      const message = readableError(cause);
      setError(message);
      setCanResend(/البريد غير (?:مؤكد|موثق)|رابط التفعيل إلى بريدك/.test(message));
    }
  };

  const resend = async () => {
    setError("");
    setSuccessMessage("");
    try {
      await resendVerification.mutateAsync({ email });
      setSuccessMessage("إذا كان لهذا البريد حساب غير مؤكد، فسيصل رابط التفعيل قريبًا.");
      setCanResend(false);
    } catch (cause) { setError(readableError(cause)); }
  };

  const recover = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    try {
      await requestPasswordReset.mutateAsync({ email });
      setSuccessMessage("إذا كان البريد مرتبطًا بحساب، فستصلك رسالة إعادة التعيين قريبًا.");
    } catch (cause) { setError(readableError(cause)); }
  };

  const destination = user?.role === "owner" ? "/owner" : user?.role === "admin" ? "/dashboard" : "/";

  return <div dir="rtl" className="meethaq-app launch-shell launch-clean atmosphere-shell reference-shell mithaq-inner-shell login-page release-login">
    <main className="section-wrap login-grid">
      <section className="login-card">
        <span className="kicker">حسابك في مِيثَاق</span>
        {user ? <>
          <h1>مرحبًا {user.name || "بك"}</h1>
          <p>{user.loginMethod === "google" ? "تم تسجيل الدخول باستخدام Google." : "تم تسجيل الدخول بالبريد الإلكتروني."}</p>
          <div className="account-role"><ShieldCheck size={19} /><span>نوع الحساب: <b>{user.role === "owner" ? "مالك الموقع" : user.role === "admin" ? "مشرف" : "عضو"}</b></span></div>
          <Link href={destination} className="primary-cta">{user.role === "owner" ? "لوحة المالك" : user.role === "admin" ? "لوحة الإدارة" : "الصفحة الرئيسية"} <ArrowLeft size={17} /></Link>
          <button className="auth-mode-toggle" type="button" onClick={() => { void logout().catch(() => setError("تعذّر تسجيل الخروج. حاول مرة أخرى.")); }}>تسجيل الخروج</button>
        </> : recoveryMode ? <>
          <h1>استعادة كلمة المرور</h1>
          <p>أدخل البريد المرتبط بحسابك، وسنرسل رابط إعادة التعيين إذا كان الحساب موجودًا.</p>
          {error && <p className="login-error" role="alert">{error}</p>}
          {successMessage && <p className="account-role" role="status">{successMessage}</p>}
          <form className="login-form" onSubmit={recover}>
            <label>البريد الإلكتروني<input required type="email" maxLength={320} autoComplete="email" inputMode="email" dir="ltr" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" /></label>
            <button type="submit" className="primary-cta login-submit" disabled={pending}>{pending ? "جارٍ الإرسال…" : "إرسال رابط الاستعادة"} <ArrowLeft size={17} /></button>
          </form>
          <button className="auth-mode-toggle" type="button" onClick={() => { setRecoveryMode(false); setError(""); setSuccessMessage(""); }}>العودة إلى تسجيل الدخول</button>
        </> : <>
          <h1>{mode === "login" ? "أهلًا بعودتك" : "أنشئ حسابك"}</h1>
          <p>{mode === "login" ? "سجّل دخولك بالبريد الإلكتروني وكلمة المرور." : "نحفظ بيانات حسابك وبصمة كلمة المرور."}</p>
          {error && <p className="login-error" role="alert">{error}</p>}
          {successMessage && <p className="account-role" role="status">{successMessage}</p>}
          <form className="login-form" onSubmit={submit}>
            {mode === "register" && <label>الاسم<input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="الاسم الذي يظهر في حسابك" /></label>}
            <label>البريد الإلكتروني<input required type="email" maxLength={320} autoComplete="email" inputMode="email" dir="ltr" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" /></label>
            <label>كلمة المرور<div className="password-field"><input required type={showPassword ? "text" : "password"} minLength={mode === "register" ? 8 : 1} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} autoCapitalize="off" autoCorrect="off" spellCheck={false} dir="auto" value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === "register" ? "أنشئ كلمة مرور قوية" : "أدخل كلمة المرور"} /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>{mode === "register" && <div className="password-rules" aria-live="polite">{passwordRules.map(rule => <span key={rule.label} className={rule.valid ? "met" : ""}><i aria-hidden="true">{rule.valid ? "✓" : "·"}</i>{rule.label}</span>)}</div>}</label>
            {mode === "register" && <label>تأكيد كلمة المرور<div className="password-field"><input required type={showConfirmPassword ? "text" : "password"} minLength={8} maxLength={128} autoComplete="new-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} dir="auto" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="أعد كتابة كلمة المرور" /><button type="button" onClick={() => setShowConfirmPassword(value => !value)} aria-label={showConfirmPassword ? "إخفاء تأكيد كلمة المرور" : "إظهار تأكيد كلمة المرور"} aria-pressed={showConfirmPassword}>{showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>}
            <button type="submit" className="primary-cta login-submit" disabled={pending || (mode === "register" && !passwordRules.every(rule => rule.valid))}>{pending ? "جارٍ التحقق…" : mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"} <ArrowLeft size={17} /></button>
          </form>
          {canResend && <button className="auth-mode-toggle" type="button" disabled={pending} onClick={() => { void resend(); }}>إعادة إرسال رابط التفعيل</button>}
          {mode === "login" && emailEnabled && <button className="auth-mode-toggle" type="button" onClick={() => { setRecoveryMode(true); setError(""); setSuccessMessage(""); }}>نسيت كلمة المرور؟</button>}
          {googleStatusReady && googleEnabled && <>
            <div className="login-divider"><span>أو</span></div>
            <button className="google-login" type="button" onClick={continueWithGoogle}>
              <svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.5a12 12 0 0 1 0-7v-5.3H5.8a20 20 0 0 0 0 17.6l6.8-5.3Z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4A20 20 0 0 0 5.8 15.2l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg>
              المتابعة باستخدام Google
            </button>
          </>}
          <button className="auth-mode-toggle" type="button" onClick={() => { setMode(value => value === "login" ? "register" : "login"); setError(""); setSuccessMessage(""); setCanResend(false); }}>{mode === "login" ? "أول مرة هنا؟ أنشئ حسابًا" : "لديك حساب بالفعل؟ سجّل الدخول"}</button>
        </>}
      </section>
      <section className="login-features"><span className="kicker">كل ما في المنصة</span><h2>معرفة موثوقة في مكان واحد</h2><div className="feature-grid">{features.map(feature => <div key={feature.title} className="feature-card"><feature.icon size={21} /><b>{feature.title}</b><small>{feature.copy}</small></div>)}</div></section>
    </main>
  </div>;
}
