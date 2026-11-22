import MithaqBrand from "@/components/MithaqBrand";
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function AuthAction() {
  const isReset = window.location.pathname === "/reset-password";
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const verify = trpc.auth.verifyEmail.useMutation();
  const reset = trpc.auth.resetPassword.useMutation();
  const pending = verify.isPending || reset.isPending;
  const passwordRulesValid = password.length >= 8 && new Set(password).size >= 4;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    if (!token) {
      setMessage("الرابط غير مكتمل. اطلب رابطًا جديدًا من صفحة تسجيل الدخول.");
      return;
    }
    try {
      if (!isReset) {
        const result = await verify.mutateAsync({ token });
        setDone(result.success);
        setMessage(result.success ? "تم تأكيد بريدك الإلكتروني. يمكنك الآن تسجيل الدخول." : "الرابط غير صالح أو انتهت صلاحيته أو سبق استخدامه.");
        return;
      }
      if (password !== confirmPassword) {
        setMessage("كلمتا المرور غير متطابقتين.");
        return;
      }
      const result = await reset.mutateAsync({ token, password });
      setDone(result.success);
      setMessage(result.success ? "تم تحديث كلمة المرور. سجّل الدخول باستخدام كلمة المرور الجديدة." : "الرابط غير صالح أو انتهت صلاحيته أو سبق استخدامه.");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setMessage(reason.startsWith("[") ? "الرابط غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا وحاول مرة أخرى." : reason || "تعذّر إتمام العملية. اطلب رابطًا جديدًا وحاول مرة أخرى.");
    }
  };

  return <div dir="rtl" className="meethaq-app launch-shell launch-clean atmosphere-shell reference-shell mithaq-inner-shell login-page release-login">
    <header className="site-header"><div className="header-inner"><MithaqBrand /><div className="header-actions" style={{ marginInlineStart: "auto" }}><Link href="/login" className="login-link">تسجيل الدخول <ArrowLeft size={15} /></Link></div></div></header>
    <main className="section-wrap login-grid">
      <section className="login-card">
        <span className="kicker">أمان حسابك</span>
        <h1>{isReset ? "إعادة تعيين كلمة المرور" : "تأكيد البريد الإلكتروني"}</h1>
        <p>{isReset ? "اختر كلمة مرور جديدة لحسابك في مِيثَاق." : "أكد ملكيتك لهذا البريد لمتابعة استخدام الحساب."}</p>
        {message && <p className={done ? "account-role" : "login-error"} role="status">{done && <ShieldCheck size={18} />}{message}</p>}
        {!done && <form className="login-form" onSubmit={submit}>
          {isReset && <>
            <label>كلمة المرور الجديدة<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} dir="auto" value={password} onChange={event => setPassword(event.target.value)} /></label>
            <p className="password-rules" aria-live="polite"><span className={password.length >= 8 ? "met" : ""}>٨ محارف على الأقل</span><span className={new Set(password).size >= 4 ? "met" : ""}>٤ محارف مختلفة على الأقل</span></p>
            <label>تأكيد كلمة المرور<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} dir="auto" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>
          </>}
          {!isReset && !token && <p className="login-error">الرابط لا يحتوي على رمز صالح.</p>}
          <button type="submit" className="primary-cta login-submit" disabled={pending || !token || (isReset && (!passwordRulesValid || password !== confirmPassword))}>{pending ? "جارٍ التحقق…" : isReset ? "حفظ كلمة المرور" : "تأكيد البريد"} <ArrowLeft size={17} /></button>
        </form>}
        <Link href="/login" className="auth-mode-toggle">العودة إلى تسجيل الدخول</Link>
      </section>
    </main>
  </div>;
}
