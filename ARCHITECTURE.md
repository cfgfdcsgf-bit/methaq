# ARCHITECTURE.md — البنية الفعلية (اقرأ القسم المعني بمهمتك فقط)

## §المسارات (Routing)
- `client/src/App.tsx`: `ThemeProvider(defaultTheme="dark", switchable)` ← `Router`. كل المسارات تشير إلى `Home` عدا `/login` ← `Login` و`/404`/الافتراضي ← `NotFound`.
  المسارات المعرّفة تشمل `/permissions` لإدارة حسابات الموقع، إضافة إلى صفحات القراءة والأقسام والأدوات.
- `client/src/pages/Home.tsx` → الدالة `Home()` هي الموجّه الفعلي: سلسلة شروط على `location` تختار الصفحة:
  `/ و/about`→`HomePage`، `/dashboard`→`Dashboard`، `/permissions`→`PermissionsPage`، `/rafiq`→`RafiqPage`، `/privacy`→`PrivacyPage`، الأدوات ومسارات `KINDS`، `isExplore()`→`ExplorePage`، وإلا `HomePage`.
- `Home()` يحيط الصفحة بـ: `Header` + `SearchPalette` (Ctrl/Cmd+K) + `MobileMenu` + `BottomNav` + `footer`، ويستدعي `useFx()` (تأثيرات).
- **إضافة مسار جديد = ثلاث نقاط:** `App.tsx` (Route) + شرط في `Home()` + (اختياري) `client/public/manus-routes.json`.

## §الواجهة (Frontend)
| الملف | المسؤولية |
|---|---|
| `pages/Home.tsx` | الهيدر، القائمة المتنقلة، التنقل السفلي، شريط الثقة، `HomePage`، `Dashboard` (بوابة صلاحيات)، `RafiqPage`، `TasbihPage`، `PrivacyPage`، تذييل. ملاحظة: `SectionPage` و`sections` معرّفتان لكن **غير مستخدمتين**. |
| `pages/Login.tsx` | دخول وإنشاء حساب محلي بالبريد وكلمة المرور، مع تحويل المالك إلى إدارة الصلاحيات. |
| `components/ContentPage.tsx` | يصدّر `KINDS` و`Kind`. صفحة محتوى عامة: بحث، تصنيفات، بطاقات، قارئ (Modal) بتحكم بحجم الخط، مفضلة، نسخ. |
| `components/AdminContent.tsx` | CRUD المواد، تغيير الحالة، استيراد JSON، إحصاءات. |
| `components/Explore.tsx` | `SECS`/`EXISTING`/`ALL`، `Atlas`، `Marquee`، `Stats`، `ExplorePage` (أنواع: grid/steps/names/events/achv)، `CountUp`، أسماء الله، المناسبات، الإنجازات. «كل الأقسام» رابط مباشر. |
| `components/Tools.tsx` | حساب مواقيت الصلاة فلكيًا، القبلة، التاريخ الهجري، `TodayStrip`، `ToolsHub`، `PrayerPage`، `KhatmaPage`، `ZakatPage`. |
| `components/SearchPalette.tsx` | بحث شامل عبر `trpc.content.list({q})` (يبدأ من حرفين). |
| `components/MushafPreview.tsx` | نموذج مصحف تفاعلي ثلاثي الأبعاد مضمّن من Sketchfab، مع نسبة العمل إلى صاحبه. |
| `components/AIChatBox.tsx` | واجهة محادثة عامة تستخدمها `RafiqPage`. |
| `lib/fx.ts` | `useFx()`: ميل ثلاثي الأبعاد للبطاقات، ظهور عند التمرير، شريط تقدم التمرير. |
| `lib/trpc.ts`, `main.tsx` | عميل tRPC (`/api/trpc`, superjson, `credentials: include`, بديل Bearer من sessionStorage)، وتحويل لتسجيل الدخول عند UNAUTHED. |
| `contexts/ThemeContext.tsx` | الوضع الداكن/الفاتح. |
| `index.css` | كل التنسيقات المخصصة (64KB، 322 سطر) — لا تقرأه كاملًا. |
| `components/ui/*` | shadcn/Radix جاهزة. |
- **غير مستخدمة حاليًا (لا تُحذف):** `DashboardLayout(+Skeleton)`, `ManusDialog`, `Map`, `pages/ComponentShowcase`, `pages/NotFound` (مستخدمة لـ 404 فقط).

## §البيانات (Database + Content API)
- `drizzle/schema.ts` (PostgreSQL):
  - `users`: id, openId(unique), name, email, loginMethod, passwordHash، role(`user|admin|owner`), createdAt, updatedAt, lastSignedIn.
  - `materials`: id, kind(`quran|sunnah|library|learning|adhkar`), title(255), category(120), body(text), source(255), grade(120), status(`draft|review|published`, default draft), createdAt, updatedAt.
- `server/db.ts`: `getDb()` (كسول، يعمل بدون DB فيُرجع فارغًا)، `upsertUser`, `getUserByOpenId`, `listMaterials` (فلاتر kind/status/publishedOnly/q بـ LIKE)، `getMaterial`, `createMaterials`, `updateMaterial`, `deleteMaterial`, `materialStats`.
- `server/routers.ts` → `appRouter`:
  - `system` (health، notifyOwner[admin]).
  - `auth.me`, `auth.localLogin`, `auth.localRegister`, `auth.logout`؛ `permissions.list/updateRole` للمالك فقط.
  - `content.list` (عام، منشورة فقط، يقتطع body إلى 220 حرفًا)، `content.get` (عام، منشورة فقط)، `adminList`, `adminGet`, `stats`, `create`, `importMany` (حتى 500), `update`, `remove` — كلها `adminProcedure`.
  - `rafiq.chat` (`protectedProcedure`).
- **تنبيه هجرة:** `materials` موجود في `schema.ts` لكن **غير موجود** في `drizzle/0000_initial_users.sql` ولا `meta/_journal.json` ولا الـ snapshot. يجب تشغيل `pnpm db:push` لتوليد migration قبل النشر/الاستخدام على قاعدة جديدة.
- بيانات المستخدم المحلية (غير مرتبطة بحساب): `localStorage` مفاتيح: `lastRead, favs, readerSize, tasbih, city, pr-YYYY-MM-DD, kh-days, kh-read, visitDays`.

## §المصادقة (Auth)
- الدخول الافتراضي: بريد وكلمة مرور محليان؛ كلمات المرور مخزّنة باستخدام scrypt، والجلسات JWT في كوكي `webdev_app_session`.
- الدخول القديم عبر Manus OAuth ما زال في الخادم للتوافق، لكنه ليس واجهة تسجيل الدخول للموقع.
- `server/_core/context.ts` يضع `ctx.user` (اختياري). `trpc.ts`: `publicProcedure`, `protectedProcedure`, `adminProcedure`.
- `OWNER_EMAIL` (بلا قيمة افتراضية؛ يجب تحديده في `.env`) يصبح `owner` عند أول تسجيل محلي في التطوير؛ لا يمكن تغيير دور المالك من لوحة الصلاحيات.
- الواجهة: `_core/hooks/useAuth.ts`؛ `Dashboard` متاح للمشرف والمالك، وإدارة الحسابات للمالك فقط.

## §الإدارة (Dashboard)
- المسار `/dashboard`: مديرو المحتوى والمالك يديرون المواد. المسار `/permissions` يسمح للمالك فقط بتبديل دور الحسابات بين عضو ومشرف.

## §رفيق (Rafiq AI)
- `server/routers.ts`: `RAFIQ_SYSTEM_PROMPT` (قواعد: لا اختلاق نص، لا فتوى، تمييز النص/الشرح، ذكر الخلاف، التحذير الختامي)، مدخلات: 1–12 رسالة، كل رسالة ≤ 4000 حرف، `maxTokens: 700`.
- يستعمل إعداد Manus عند وجوده، أو مزودًا متوافقًا مع OpenAI عند ضبط `OPENAI_API_KEY` و`OPENAI_MODEL` في `.env`.
- الإخراج: `{ answer, sources: [] (فارغة دائمًا), notice }`. لا يوجد استرجاع من جدول `materials` ولا إحالات فعلية.
- الواجهة: `RafiqPage` (للمسجلين فقط).

## §الاستكشاف (Explore)
- `EXISTING` (10 أقسام مرتبطة بصفحات حقيقية) + `SECS` (12 قسمًا) = 22 قسمًا في `Atlas`.
- أنواع `SECS`: `names` (100 بطاقة)، `events` (عدّ تنازلي بتقويم أم القرى)، `achv` (سلسلة زيارات)، `grid`/`steps` (عناوين ثابتة بنص بديل «يُضاف المحتوى من لوحة الإدارة» — **غير مربوطة بقاعدة البيانات**).

## §المنصة (server/_core — Manus)
`index.ts` (Express: `/api/health`, `/api/platform/config.js`, OAuth, tRPC، ثم Vite/ static)، `env.ts`, `publicConfig.ts`, `sdk.ts`, `cookies.ts`, `llm.ts`, `storageProxy.ts`/`../storage.ts`, `imageGeneration.ts`, `voiceTranscription.ts`, `map.ts`, `dataApi.ts`, `notification.ts`, `heartbeat.ts`, `vite.ts`. المستخدم فعليًا من التطبيق: `index, env, publicConfig, sdk, cookies, context, trpc, oauth, systemRouter, notification, llm, vite`. الباقي جاهز لكن غير مستخدم (imageGeneration يستخدم `storage.ts`).
