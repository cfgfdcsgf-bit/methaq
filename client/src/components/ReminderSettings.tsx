import GlassHeading from "@/components/GlassHeading";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Bell, BellOff, Download, Volume2 } from "lucide-react";
import { PRAYERS } from "@shared/prayer";
import { TIMED_REMINDERS, type ReminderPrefs } from "@shared/reminders";
import { disableReminders, enableReminders, readReminderPrefs, reminderConfig, remindersEnabled, sendTestReminder, supportsPush } from "@/lib/reminders";
import { getCity } from "@/components/Tools";
import { previewAdhan } from "@/components/AdhanPlayback";

type InstallPrompt = Event & { prompt: () => Promise<unknown> };
let installPrompt: InstallPrompt | null = null;
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event as InstallPrompt;
  window.dispatchEvent(new Event("meethaq-install-ready"));
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  window.dispatchEvent(new Event("meethaq-install-ready"));
});

export default function ReminderSettings() {
  const [prefs, setPrefs] = useState(readReminderPrefs);
  const [config, setConfig] = useState<{ available: boolean; publicKey?: string }>();
  const [enabled, setEnabled] = useState(remindersEnabled);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [canInstall, setCanInstall] = useState(Boolean(installPrompt));
  const [reducedEffects, setReducedEffects] = useState(() => document.documentElement.dataset.effects === "reduced");
  const supported = supportsPush();
  useEffect(() => {
    void reminderConfig().then(setConfig).catch(() => setConfig({ available: false }));
    const installChanged = () => setCanInstall(Boolean(installPrompt));
    const permissionChanged = () => setEnabled(remindersEnabled());
    window.addEventListener("meethaq-install-ready", installChanged);
    window.addEventListener("focus", permissionChanged);
    return () => { window.removeEventListener("meethaq-install-ready", installChanged); window.removeEventListener("focus", permissionChanged); };
  }, []);
  const change = (next: ReminderPrefs) => { setPrefs(next); setMessage(""); };
  const task = async (action: "save" | "stop" | "test") => {
    setPending(true); setMessage("");
    try {
      if (action === "save") {
        if (!config?.publicKey) throw new Error("config");
        await enableReminders(prefs, getCity(), config.publicKey);
        setEnabled(true); setMessage("حُفظت إعدادات التنبيهات لهذا الجهاز.");
      } else if (action === "stop") {
        await disableReminders();
        setEnabled(false); setMessage("أُوقفت تنبيهات مِيثَاق لهذا الجهاز.");
      } else {
        await sendTestReminder(); setMessage("أُرسل التنبيه التجريبي. راجع إشعارات جهازك.");
      }
    } catch (error) {
      setMessage((error as Error).message === "permission" ? "لم يمنح المتصفح إذن التنبيهات. يمكنك تغييره من إعدادات الجهاز." : "تعذّر إتمام الطلب. تحقّق من الاتصال وحاول مجددًا.");
    } finally { setPending(false); }
  };
  return <main className="section-wrap companion-page reminder-page">
    <GlassHeading icon={Bell} label="تفضيلات هذا الجهاز" title="الإعدادات" description="اختر ما يذكّرك به مِيثَاق والوقت المناسب لك."
      action={<Link className="detail-btn" href="/my-day">متابعتي</Link>} />
    <div className="glass-settings-grid">
    <section className="reminder-panel" aria-labelledby="effects-heading">
      <h2 id="effects-heading">المظهر</h2>
      <label className="reminder-row">تأثيرات أقل <input type="checkbox" checked={reducedEffects} onChange={event => {
        const enabled = event.target.checked;
        setReducedEffects(enabled);
        document.documentElement.dataset.effects = enabled ? "reduced" : "normal";
        try { localStorage.setItem("meethaq-reduced-effects", String(enabled)); } catch { /* Keep the preference for this session. */ }
      }} /></label>
    </section>
    <section className="reminder-panel reminder-install" aria-labelledby="reminder-install-heading">
      <h2 id="reminder-install-heading"><Download size={20} /> تثبيت مِيثَاق</h2>
      {canInstall ? <button className="detail-btn" type="button" onClick={() => { void installPrompt?.prompt(); installPrompt = null; setCanInstall(false); }}>ثبّت على هذا الجهاز</button>
        : <p>من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». على iPhone، افتح مِيثَاق من الشاشة الرئيسية بعد إضافته عبر زر المشاركة في Safari.</p>}
    </section>
    <section className="reminder-panel" aria-labelledby="reminders-heading">
      <h2 id="reminders-heading"><Bell size={20} /> تذكيراتك</h2>
      <p>تُستخدم مدينتك لحساب مواعيد تنبيهات الصلاة ورمضان.</p>
      {!supported && <p className="reminder-note">التنبيهات تحتاج متصفحًا يدعمها واتصالًا آمنًا. على iPhone فعّلها من نسخة الشاشة الرئيسية.</p>}
      {supported && config?.available === false && <p className="reminder-note">خدمة إرسال التنبيهات غير مفعّلة على هذا الخادم.</p>}
      {supported && Notification.permission === "denied" && <p className="reminder-note">التنبيهات محظورة لهذا الموقع من إعدادات المتصفح.</p>}
      <fieldset disabled={pending}>
        <legend>الذكر والورد</legend>
        {TIMED_REMINDERS.map(({ key, label }) => <div className="reminder-row" key={key}><label><input type="checkbox" role="switch" checked={prefs.timed[key].on} onChange={e => change({ ...prefs, timed: { ...prefs.timed, [key]: { ...prefs.timed[key], on: e.target.checked } } })} />{label}</label>
          <input type="time" aria-label={`وقت تذكير ${label}`} value={prefs.timed[key].time} disabled={!prefs.timed[key].on} onChange={e => { if (e.target.value) change({ ...prefs, timed: { ...prefs.timed, [key]: { ...prefs.timed[key], time: e.target.value } } }); }} /></div>)}
        <label className="reminder-row"><span>تنبيهات الفجر والمغرب في رمضان</span><input type="checkbox" role="switch" checked={prefs.ramadan} onChange={e => change({ ...prefs, ramadan: e.target.checked })} /></label>
      </fieldset>
      <fieldset disabled={pending}>
        <legend>مواقيت الصلاة</legend>
        {PRAYERS.map(([key, label]) => <label className="reminder-row" key={key}>{label}<select aria-label={`تنبيه ${label}`} value={prefs.prayers[key]} onChange={e => change({ ...prefs, prayers: { ...prefs.prayers, [key]: e.target.value as ReminderPrefs["prayers"][typeof key] } })}><option value="off">متوقف</option><option value="silent">تنبيه صامت</option><option value="sound">صوت الجهاز</option><option value="adhan">الأذان</option></select></label>)}
        <p className="reminder-note"><Volume2 size={17} /> يمكن تشغيل الأذان عند الموعد ما دام مِيثَاق مفتوحًا بعد تجربة الصوت أدناه. عند إغلاقه، اضغط على إشعار الصلاة لفتح المشغّل.</p>
        <button className="detail-btn" type="button" onClick={previewAdhan}><Volume2 size={16} /> جرّب صوت الأذان</button>
      </fieldset>
      <div className="daily-inline reminder-actions">
        <button className="primary-cta" disabled={pending || !supported || !config?.available} onClick={() => void task("save")}>{enabled ? "حفظ التنبيهات" : "تفعيل التنبيهات"}</button>
        {enabled && <><button className="detail-btn" disabled={pending} onClick={() => void task("test")}><Bell size={17} />تنبيه تجريبي</button><button className="detail-btn" disabled={pending} onClick={() => void task("stop")}><BellOff size={17} />إيقاف الكل</button></>}
      </div>
      {message && <p className="reminder-note" role="status">{message}</p>}
    </section>
    </div>
  </main>;
}
