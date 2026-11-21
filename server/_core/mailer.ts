import { ENV } from "./env";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** True when verification and reset emails can be sent. Without it those features stay switched off. */
export const mailAvailable = () => ENV.mailConfigured;

export async function sendMail(to: string, subject: string, html: string, text: string) {
  if (!ENV.mailConfigured) throw new Error("MAIL_NOT_CONFIGURED");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${ENV.mailApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: ENV.mailFrom, to: [to], subject, html, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`MAIL_SEND_FAILED_${response.status}`);
}

function layout(title: string, intro: string, link: string, action: string, note: string) {
  const safeLink = escapeHtml(link);
  return `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#192522;max-width:520px;margin:auto">
<h2 style="color:#0e5a4d;margin:0 0 8px">${escapeHtml(title)}</h2>
<p>${escapeHtml(intro)}</p>
<p><a href="${safeLink}" style="display:inline-block;background:#0e5a4d;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none">${escapeHtml(action)}</a></p>
<p style="color:#5d6b64;font-size:13px">${escapeHtml(note)}</p>
<p style="color:#5d6b64;font-size:12px;direction:ltr;word-break:break-all">${safeLink}</p></div>`;
}

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${ENV.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  await sendMail(to, "تأكيد بريدك في مِيثَاق",
    layout("أهلًا بك في مِيثَاق", "اضغط الزر لتأكيد بريدك الإلكتروني وتفعيل رفيق.", link, "تأكيد البريد", "ينتهي هذا الرابط بعد 24 ساعة. إن لم تنشئ حسابًا فتجاهل الرسالة."),
    `أهلًا بك في مِيثَاق. أكّد بريدك من الرابط: ${link}`);
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${ENV.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail(to, "إعادة تعيين كلمة المرور في مِيثَاق",
    layout("إعادة تعيين كلمة المرور", "طلبت إعادة تعيين كلمة المرور. اضغط الزر لاختيار كلمة جديدة.", link, "اختيار كلمة مرور جديدة", "ينتهي هذا الرابط بعد ساعة ويعمل مرة واحدة. إن لم تطلب ذلك فتجاهل الرسالة؛ كلمتك لم تتغير."),
    `لإعادة تعيين كلمة المرور افتح الرابط: ${link}`);
}
