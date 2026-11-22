import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import pg from "pg";

test("production routing sends JSON for unknown APIs and supplies site headers", async ({ request }) => {
  const unknown = await request.get("/api/path-that-does-not-exist");
  expect(unknown.status()).toBe(404);
  expect(await unknown.json()).toEqual({ error: "not_found" });
  const home = await request.get("/", { headers: { "Accept-Encoding": "gzip" } });
  expect(home.headers()["content-security-policy"]).toContain("script-src 'self'");
  expect(home.headers()["content-encoding"]).toBe("gzip");
  const health = await request.get("/api/health");
  expect(health.status()).toBe(process.env.MEETHAQ_E2E_DATABASE_URL ? 200 : 503);
});

test("the offline worker registers when the app entry loads after the page", async ({ page }) => {
  let entryUrl = "";
  await page.route("**/", async route => {
    if (!route.request().isNavigationRequest()) return route.continue();
    const response = await route.fetch();
    const html = (await response.body()).toString("utf8");
    const entry = html.match(/<script type="module"[^>]*src="(\/assets\/index-[^"]+\.js)"[^>]*><\/script>/);
    if (!entry) throw new Error("Production app entry was not found");
    entryUrl = entry[1];
    await route.fulfill({ response, body: html.replace(entry[0], "") });
  });
  await page.goto("/", { waitUntil: "load" });
  expect(entryUrl).toMatch(/^\/assets\/index-/);
  await page.evaluate(src => {
    const entry = document.createElement("script");
    entry.type = "module";
    entry.src = src;
    document.head.append(entry);
  }, entryUrl);
  await expect(page.getByRole("main")).toBeVisible();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 12_000 });
});

test("stores an Edge-shaped push subscription and honors device removal", async ({ request }) => {
  test.skip(!process.env.MEETHAQ_E2E_DATABASE_URL, "Requires an isolated PostgreSQL database.");
  const token = randomUUID();
  const endpoint = "https://wns2.example.notify.windows.com/w/?token=" + token;
  const data = {
    subscription: { endpoint, keys: { p256dh: Buffer.alloc(65, 1).toString("base64url"), auth: Buffer.alloc(16, 2).toString("base64url") } },
    prefs: {
      prayers: { fajr: "off", dhuhr: "off", asr: "off", maghrib: "off", isha: "off" },
      timed: Object.fromEntries(["morning", "evening", "sleep", "ward"].map(key => [key, { on: false, time: "07:00" }])),
      ramadan: false,
    },
    city: { lat: 30.04, lng: 31.24, tz: "Africa/Cairo", hijriOffset: 1 },
  };
  const saved = await request.put("/api/reminders/device", { data });
  expect(saved.ok()).toBe(true);
  const access = await saved.json();
  expect(access.token).toHaveLength(43);
  const changed = await request.put("/api/reminders/device", { data: { ...data, token: access.token } });
  expect((await changed.json()).token).toBe(access.token);
  const removed = await request.delete("/api/reminders/device", { data: { endpoint, token: access.token } });
  expect(removed.status()).toBe(204);
});

test("downloads a Quran part, saves a mark, and opens its printed verse offline", async ({ page, context }) => {
  await page.goto("/quran");
  await expect(page.getByRole("heading", { name: "المصحف الشريف" })).toBeVisible();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.locator("summary", { hasText: /^العرض$/ }).click();
  await page.getByRole("button", { name: "تنزيل الجزء للقراءة بلا اتصال" }).click();
  await expect(page.getByText(/جاهز للقراءة بلا اتصال/)).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("انتقل إلى صفحة من المصحف", { exact: true }).selectOption("3");
  if (!(await page.getByRole("button", { name: "إضافة علامة للصفحة" }).isVisible())) {
    await page.locator("summary", { hasText: /^العرض$/ }).click();
  }
  await page.getByRole("button", { name: "إضافة علامة للصفحة" }).click();
  await expect(page.getByRole("button", { name: "إزالة علامة الصفحة" })).toBeVisible();
  await context.setOffline(true);
  await page.goto("/quran?page=3", { waitUntil: "domcontentloaded" });
  const pageImage = page.locator('img[src*="/003.webp"]');
  await expect(pageImage).toBeVisible();
  await expect.poll(() => pageImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.locator(".mushaf-print-ayah span").first().click();
  await expect(page.getByRole("complementary", { name: "التفسير والتلاوة" })).toBeVisible();
});

test("downloads the complete Mushaf and opens its last page offline", async ({ page, context }) => {
  test.setTimeout(100_000);
  await page.goto("/quran?page=1");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.locator("summary", { hasText: /^العرض$/ }).click();
  await page.getByRole("button", { name: /تنزيل المصحف كاملًا/ }).click();
  await expect(page.getByText(/المصحف كاملًا جاهز للقراءة بلا اتصال/)).toBeVisible({ timeout: 80_000 });
  await context.setOffline(true);
  await page.goto("/quran?page=604", { waitUntil: "domcontentloaded" });
  const image = page.locator('img[src*="/604.webp"]');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  const ayahPicker = page.getByRole("combobox", { name: "اختر آية للتفسير والتلاوة" });
  await ayahPicker.selectOption({ index: 1 });
  await expect(page.getByRole("complementary", { name: "التفسير والتلاوة" })).toBeVisible();
});

test("recitation stays mounted during navigation inside the site", async ({ page }) => {
  await page.route("https://api.alquran.cloud/v1/edition/**", route => route.fulfill({ json: { data: [] } }));
  await page.route("https://api.alquran.cloud/v1/surah/1/**", route => route.fulfill({ json: {
    code: 200, data: { ayahs: [{ number: 1, numberInSurah: 1, audio: "https://audio.invalid/qa.wav" }] },
  } }));
  const samples = 16_000 * 10;
  const audio = Buffer.alloc(44 + samples * 2);
  audio.write("RIFF", 0);
  audio.writeUInt32LE(audio.length - 8, 4);
  audio.write("WAVEfmt ", 8);
  audio.writeUInt32LE(16, 16);
  audio.writeUInt16LE(1, 20);
  audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(16_000, 24);
  audio.writeUInt32LE(32_000, 28);
  audio.writeUInt16LE(2, 32);
  audio.writeUInt16LE(16, 34);
  audio.write("data", 36);
  audio.writeUInt32LE(samples * 2, 40);
  await page.route("https://audio.invalid/qa.wav", route => route.fulfill({ contentType: "audio/wav", body: audio }));
  await page.goto("/quran");
  await page.getByRole("button", { name: "استمع إلى السورة" }).click();
  const player = page.locator(".quran-audio-player audio");
  await expect.poll(() => player.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0);
  await page.getByLabel("سرعة التلاوة").selectOption("1.25");
  await page.locator(".reference-top-nav").getByRole("link", { name: "الرئيسية" }).click();
  await expect(page).toHaveURL("/");
  await expect(player).toHaveJSProperty("playbackRate", 1.25);
});

test("mobile navigation opens the monthly prayer table and saves reduced effects", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("navigation", { name: "تنقل سريع" }).getByRole("link", { name: "الصلاة" }).click();
  await page.getByText("جدول الصلاة الشهري", { exact: true }).click();
  await expect(page.locator(".prayer-monthly tbody tr").first()).toBeVisible();
  await page.goto("/settings");
  await page.getByLabel("تأثيرات أقل").check();
  await page.reload();
  await expect(page.getByLabel("تأثيرات أقل")).toBeChecked();
});

test("the light theme has a light surrounding canvas and legible navigation", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("/about");
  const header = page.locator(".reference-header");
  await expect(header).toHaveCSS("background-color", "rgb(239, 248, 241)");
  await expect(header).toHaveCSS("color", "rgb(23, 58, 46)");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(251, 245, 230)");
});

async function register(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: /أنشئ حسابًا/ }).click();
  await page.getByLabel("الاسم", { exact: true }).fill("حساب اختبار");
  await page.getByLabel("البريد الإلكتروني", { exact: true }).fill(email);
  await page.locator('input[autocomplete="new-password"]').nth(0).fill(password);
  await page.locator('input[autocomplete="new-password"]').nth(1).fill(password);
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await expect(page).toHaveURL("/");
}

test("a registered account restores its tasbih count on a second browser profile", async ({ page, browser }) => {
  test.skip(!process.env.MEETHAQ_E2E_DATABASE_URL, "Requires an isolated PostgreSQL database.");
  const email = `${randomUUID()}@example.com`;
  const password = "عبارة مرور اختبارية 82";
  await register(page, email, password);
  await page.goto("/tasbih");
  const sync = page.waitForResponse(response => response.url().includes("progress.sync") && response.ok() && response.request().postData()?.includes('"tasbih"') === true);
  await page.getByRole("button", { name: "زيادة العدّاد" }).click();
  await sync;

  const second = await browser.newContext({ baseURL: page.url() });
  try {
    const other = await second.newPage();
    await other.goto("/login");
    await other.getByLabel("البريد الإلكتروني", { exact: true }).fill(email);
    await other.locator('input[autocomplete="current-password"]').fill(password);
    await other.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
    await expect(other).toHaveURL("/");
    await other.goto("/tasbih");
    await expect(other.getByRole("button", { name: "زيادة العدّاد" }).locator("strong")).toHaveText("١");
  } finally { await second.close(); }
});

test("a stale tab cannot write progress into the account signed in by another tab", async ({ page, context }) => {
  test.skip(!process.env.MEETHAQ_E2E_DATABASE_URL, "Requires an isolated PostgreSQL database.");
  const password = "عبارة مرور اختبارية 82";
  await register(page, `${randomUUID()}@example.com`, password);
  const firstAccount = (await (await page.request.get("/api/trpc/auth.me")).json()).result.data.json.id;
  await page.goto("/tasbih");
  const counter = page.getByRole("button", { name: "زيادة العدّاد" });
  const saved = page.waitForResponse(response => response.url().includes("progress.sync") && response.ok() && response.request().postData()?.includes('"tasbih"') === true);
  await counter.click();
  await saved;
  await page.route("**/*auth.me*", route => route.abort());

  const other = await context.newPage();
  const logout = await other.request.post("/api/trpc/auth.logout", { data: { json: null } });
  expect(logout.ok()).toBe(true);
  await register(other, `${randomUUID()}@example.com`, password);
  const newAccount = (await (await other.request.get("/api/trpc/auth.me")).json()).result.data.json.id;
  await expect.poll(() => other.evaluate(() => localStorage.getItem("meethaq-progress-local-owner"))).toBe(String(newAccount));
  await expect(counter.locator("strong")).toHaveText("١");
  await counter.click();
  expect(await other.evaluate(() => localStorage.getItem("tasbih"))).toBeNull();

  const stale = await page.request.post("/api/trpc/progress.sync", { data: { json: { accountId: firstAccount, items: { tasbih: { v: "99", t: Date.now() } } } } });
  expect(stale.status()).toBe(409);
  const current = await other.request.post("/api/trpc/progress.sync", { data: { json: { accountId: newAccount, items: {} } } });
  expect(current.ok()).toBe(true);
  expect((await current.json()).result.data.json).not.toHaveProperty("tasbih");
});

test("an owner can archive and restore a hadith and the reader keeps keyboard focus", async ({ page }) => {
  const connectionString = process.env.MEETHAQ_E2E_DATABASE_URL;
  test.skip(!connectionString, "Requires an isolated PostgreSQL database.");
  const email = `${randomUUID()}@example.com`;
  await register(page, email, "عبارة اختبار طويلة 96");
  const id = await (async () => {
    const db = new pg.Client({ connectionString });
    await db.connect();
    try {
      await db.query("update users set role='owner' where email=$1", [email]);
      const result = await db.query("insert into materials (kind,title,body,source,grade,status,category) values ('sunnah','موضوع لاختبار الأرشفة','محتوى اختبار مؤقت','مرجع اختباري','درجة اختبارية','published','قسم اختباري') returning id");
      return result.rows[0].id as number;
    } finally { await db.end(); }
  })();
  await page.goto("/sunnah");
  const opener = page.getByRole("button", { name: /اقرأ المادة.*موضوع لاختبار الأرشفة/ });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("مرجع اختباري")).toBeVisible();
  for (let step = 0; step < 6; step++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  for (const archived of [true, false]) {
    const response = await page.request.post("/api/trpc/content.setArchived", { data: { json: { id, archived } } });
    expect(response.ok()).toBe(true);
    await page.reload();
    await expect(opener).toHaveCount(0);
  }
  const audit = await page.request.get("/api/trpc/content.history", { params: { input: JSON.stringify({ json: { id } }) } });
  expect(await audit.text()).toContain('"restore"');
});
