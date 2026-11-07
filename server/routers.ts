import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { invokeLLM } from "./_core/llm";
import { hashPassword, verifyPassword } from "./_core/passwords";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { adminProcedure, ownerProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { z } from "zod";

const kindEnum = z.enum(["quran", "sunnah", "library", "learning", "adhkar"]);
const materialInput = z.object({
  kind: kindEnum,
  title: z.string().trim().min(1).max(255),
  category: z.string().trim().max(120).nullish(),
  body: z.string().min(1).max(60000),
  source: z.string().trim().max(255).nullish(),
  grade: z.string().trim().max(120).nullish(),
  status: z.enum(["draft", "review", "published"]),
});
const excerpt = <T extends { body: string }>(m: T) => ({ ...m, body: m.body.slice(0, 220) });
const publicMaterial = <T extends { source?: unknown; grade?: unknown }>(material: T) => {
  const { source: _source, grade: _grade, ...visibleFields } = material;
  return visibleFields;
};

const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const LOCAL_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
let dummyPasswordHash: Promise<string> | undefined;
function allowAuthAttempt(ip: string) {
  const now = Date.now();
  if (authAttempts.size > 2000) {
    for (const [key, value] of authAttempts) if (value.resetAt <= now) authAttempts.delete(key);
  }
  const current = authAttempts.get(ip);
  if (!current || current.resetAt <= now) {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return true;
  }
  if (current.count >= 8) return false;
  current.count += 1;
  return true;
}

function clearAuthAttempts(ip: string) { authAttempts.delete(ip); }

function attachSession(ctx: { req: Request; res: Response }, user: { openId: string; name: string | null }) {
  return sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: LOCAL_SESSION_MS }).then(token => {
    ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: LOCAL_SESSION_MS });
  });
}

const emailSchema = z.string().trim().toLowerCase().email().max(320);
const COMMON_PASSWORDS = new Set(["password", "password1", "12345678", "123456789", "1234567890", "qwertyuiop", "11111111", "iloveyou", "abc12345", "admin1234", "letmein123", "welcome123", "meethaq123"]);
const passwordSchema = z.string()
  .min(10, "كلمة المرور لازم تكون 10 أحرف على الأقل.")
  .max(128, "كلمة المرور لا يمكن أن تتجاوز 128 حرفًا.")
  .refine(value => !/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u.test(value), "استخدم حروفًا لاتينية في كلمة المرور؛ الحروف العربية غير مدعومة.")
  .refine(value => /[A-Z]/.test(value), "أضف حرفًا لاتينيًا كبيرًا واحدًا على الأقل.")
  .refine(value => /[a-z]/.test(value), "أضف حرفًا لاتينيًا صغيرًا واحدًا على الأقل.")
  .refine(value => /[0-9]/.test(value), "أضف رقمًا واحدًا على الأقل.")
  .refine(value => /[^A-Za-z0-9\s]/.test(value), "أضف رمزًا خاصًا واحدًا على الأقل، مثل ! أو @ أو #.")
  .refine(value => !COMMON_PASSWORDS.has(value.toLowerCase()), "كلمة المرور شائعة جدًا. اختر كلمة أصعب في التخمين.")
  .refine(value => new Set(value).size >= 4, "كلمة المرور بسيطة جدًا. استخدم أحرفًا متنوعة أكثر.");

const rafiqMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const RAFIQ_SYSTEM_PROMPT = `أنت «رفيق»، مساعد معرفي إسلامي داخل منصة مِيثَاق.
مهمتك مساعدة المستخدم على الفهم والبحث، ولست مفتيًا ولا عالمًا ولا جهة اعتماد.
قواعد إلزامية:
1) لا تخترع آية أو حديثًا أو قول عالم أو رقم سورة/آية أو تخريجًا. إذا لم تملك مصدرًا محددًا في سياق المحادثة، قل بوضوح إنك لا تملك مادة موثقة كافية.
2) لا تصدر فتوى أو حكمًا شرعيًا جازمًا، ولا تستخدم عبارات مثل «هذا حلال قطعًا» أو «هذا حرام قطعًا» دون مصدر فقهي محدد ومعتبر. في أسئلة الفتوى وجّه المستخدم لمراجعة عالم موثوق.
3) ميّز صراحة بين «نص منقول» و«شرح عام» و«اقتراح للبحث». لا تنسب أي نص للمقدس أو للنبي ﷺ بلا إحالة.
4) عند وجود خلاف معتبر، اذكر أنه خلاف ولا تخفِ حدود المعلومة.
5) اجعل الإجابة بالعربية الواضحة، هادئة ومختصرة، وابدأ بتحذير المصدر عند الحاجة.
6) لا تتظاهر بأنك تحققت من الإنترنت أو من قاعدة بيانات لم تُعرض لك. اختم الإجابات الشرعية الحساسة بعبارة: «للمسائل الخاصة أو الفتوى، راجع عالمًا موثوقًا.»
7) إذا طلب المستخدم شيئًا خارج المعرفة الإسلامية، ساعده فقط إذا أمكن ربطه بسياق تعليمي آمن، وإلا وضّح حدود رفيق.`;

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    localRegister: publicProcedure
      .input(z.object({
        name: z.string().trim().min(2).max(100),
        email: emailSchema,
        password: passwordSchema,
      }))
      .mutation(async ({ input, ctx }) => {
        if (!allowAuthAttempt(ctx.req.ip || "unknown")) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى." });
        }
        try {
          const user = await db.createLocalUser({ ...input, passwordHash: await hashPassword(input.password) });
          await attachSession(ctx, user);
          return { role: user.role };
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message === "EMAIL_ALREADY_REGISTERED") {
            throw new TRPCError({ code: "CONFLICT", message: "يوجد حساب بهذا البريد. سجّل الدخول بدل إنشاء حساب جديد." });
          }
          if (message === "OWNER_BOOTSTRAP_DISABLED") {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "حساب المالك يُجهّز أولًا على نسخة الموقع المحلية قبل تشغيل الإنتاج." });
          }
          throw error;
        }
      }),
    localLogin: publicProcedure
      .input(z.object({ email: emailSchema, password: z.string().min(1).max(128) }))
      .mutation(async ({ input, ctx }) => {
        if (!allowAuthAttempt(ctx.req.ip || "unknown")) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى." });
        }
        const user = await db.getUserByEmail(input.email);
        const storedHash = user?.passwordHash ?? await (dummyPasswordHash ??= hashPassword("meethaq-invalid-login-dummy"));
        const valid = await verifyPassword(input.password, storedHash);
        if (!user || !user.passwordHash || !valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
        }
        await attachSession(ctx, user);
        clearAuthAttempts(ctx.req.ip || "unknown");
        return { role: user.role };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  permissions: router({
    list: ownerProcedure.query(() => db.listUsersForOwner()),
    updateRole: ownerProcedure
      .input(z.object({ id: z.number().int().positive(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input }) => {
        const updated = await db.updateUserRole(input.id, input.role);
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب غير موجود أو حساب المالك لا يمكن تغيير صلاحيته." });
        return { ok: true };
      }),
  }),

  content: router({
    list: publicProcedure
      .input(z.object({ kind: kindEnum.optional(), q: z.string().max(100).optional(), limit: z.number().int().min(1).max(100).optional() }))
      .query(async ({ input }) => (await db.listMaterials({ ...input, publishedOnly: true })).map(material => publicMaterial(excerpt(material)))),
    get: publicProcedure.input(z.object({ id: z.number().int() })).query(async ({ input }) => {
      const m = await db.getMaterial(input.id);
      return m && m.status === "published" ? publicMaterial(m) : null;
    }),
    adminList: adminProcedure
      .input(z.object({ kind: kindEnum.optional(), status: z.enum(["draft", "review", "published"]).optional() }).optional())
      .query(async ({ input }) => (await db.listMaterials({ ...input, limit: 500 })).map(excerpt)),
    adminGet: adminProcedure.input(z.object({ id: z.number().int() })).query(({ input }) => db.getMaterial(input.id)),
    stats: adminProcedure.query(() => db.materialStats()),
    create: adminProcedure.input(materialInput).mutation(async ({ input }) => {
      if (input.status === "published") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أضف المادة كمسودة أو أرسلها للمراجعة أولًا." });
      if (input.status === "review" && !input.source?.trim()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أضف مصدر المادة قبل إرسالها للمراجعة." });
      return { count: await db.createMaterials([input]) };
    }),
    importMany: adminProcedure.input(z.object({ items: z.array(materialInput).min(1).max(500) })).mutation(async ({ input }) => ({
      count: await db.createMaterials(input.items.map(item => ({ ...item, status: "draft" as const }))),
    })),
    update: adminProcedure.input(z.object({ id: z.number().int(), data: materialInput.partial() })).mutation(async ({ input, ctx }) => {
      const current = await db.getMaterial(input.id);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "المادة غير موجودة." });
      const contentFields = ["kind", "title", "category", "body", "source", "grade"] as const;
      const contentChanged = contentFields.some(field => input.data[field] !== undefined && input.data[field] !== current[field]);
      const nextStatus = input.data.status ?? current.status;
      const nextSource = input.data.source ?? current.source;

      if (current.status === "published" && contentChanged && nextStatus !== "review") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أعد المادة المنشورة إلى المراجعة قبل تعديل محتواها." });
      }
      if (nextStatus === "review" && !nextSource?.trim()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أضف مصدر المادة قبل إرسالها للمراجعة." });
      }
      if (nextStatus === "published" && current.status !== "published") {
        if (current.status !== "review") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يجب أن تمر المادة بالمراجعة قبل نشرها." });
        if (ctx.user.role !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: "اعتماد النشر النهائي متاح لمالك الموقع." });
        if (!nextSource?.trim()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن نشر مادة بلا مصدر." });
      }
      await db.updateMaterial(input.id, input.data);
      return { ok: true };
    }),
    remove: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input }) => { await db.deleteMaterial(input.id); return { ok: true }; }),
  }),

  rafiq: router({
    chat: protectedProcedure
      .input(z.object({ messages: z.array(rafiqMessage).min(1).max(12) }))
      .mutation(async ({ input }) => {
        const result = await invokeLLM({
          messages: [
            { role: "system", content: RAFIQ_SYSTEM_PROMPT },
            ...input.messages,
          ],
          maxTokens: 700,
        });

        const content = result.choices?.[0]?.message?.content;
        const answer = typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content.filter(part => part.type === "text").map(part => part.text).join("\n")
            : "لم أتمكن من توليد إجابة موثوقة الآن.";

        return {
          answer: answer || "لم أتمكن من توليد إجابة موثوقة الآن.",
          sources: [],
          notice: "رفيق لا يصدر فتاوى، ولا يتصل حاليًا بمصادر موثقة داخل الموقع؛ تحقّق من أي نص قبل الاعتماد عليه.",
        };
      }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
