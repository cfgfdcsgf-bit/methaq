import { createECDH, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Express, RequestHandler } from "express";
import { and, eq, sql } from "drizzle-orm";
import * as webPushModule from "web-push";
import { z } from "zod";
import { pushDevices } from "../../drizzle/schema";
import { getDb } from "../db";
import { scheduleReminders, TEST_REMINDER } from "../../shared/reminders";

const webPush = webPushModule as unknown as {
  generateVAPIDKeys(): { publicKey: string; privateKey: string };
  sendNotification(subscription: Subscription, payload: string, options: { TTL: number; timeout: number; vapidDetails: { subject: string; publicKey: string; privateKey: string } }): Promise<unknown>;
};
const code = /^[A-Za-z0-9_-]+$/;
const key = (bytes: number) => z.string().regex(code).refine(value => Buffer.from(value, "base64url").length === bytes);
const vapidKeyPair = z.object({ publicKey: key(65), privateKey: key(32) });
const mode = z.enum(["off", "silent", "sound", "adhan"]);
const time = z.object({ on: z.boolean(), time: z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/) });
const offset = z.number().int().min(-30).max(30).optional();
const prefs = z.object({
  prayers: z.object({ fajr: mode, dhuhr: mode, asr: mode, maghrib: mode, isha: mode }),
  timed: z.object({ morning: time, evening: time, sleep: time, ward: time }),
  ramadan: z.boolean(),
});
export function allowedPushEndpoint(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
  if (/^(?:[a-z0-9-]+\.)+notify\.windows\.com$/.test(url.hostname)) {
    return /^\/w(?:\/|$)/.test(url.pathname) && url.searchParams.getAll("token").length <= 1
      && Array.from(url.searchParams.keys()).every(key => key === "token");
  }
  return !url.search && [
    ["fcm.googleapis.com", "/fcm/send/"],
    ["updates.push.services.mozilla.com", "/wpush/"],
    ["web.push.apple.com", "/"],
  ].some(([host, path]) => url.hostname === host && url.pathname.startsWith(path) && url.pathname.length > path.length);
}
const subscription = z.object({
  endpoint: z.url().max(2048).refine(allowedPushEndpoint),
  keys: z.object({ p256dh: key(65), auth: key(16) }),
});
const timezone = z.string().max(80).refine(value => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
});
const setup = z.object({
  subscription,
  prefs,
  city: z.object({
    lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), tz: timezone,
    method: z.enum(["egypt", "mwl", "isna", "makkah"]).optional(), hanafi: z.boolean().optional(),
    hijriOffset: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional(),
    offsets: z.object({ fajr: offset, sunrise: offset, dhuhr: offset, asr: offset, maghrib: offset, isha: offset }).optional(),
  }),
  token: z.string().length(43).regex(code).optional(),
});
type Subscription = z.infer<typeof subscription>;
const deviceToken = z.string().length(43).regex(code);
const recordSchema = setup.omit({ token: true }).extend({ sent: z.record(z.string(), z.number()) });
const legacyEntry = recordSchema.extend({ token: deviceToken });
type RecordEntry = z.infer<typeof recordSchema>;
type Device = { token: string; record: RecordEntry };
const matches = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function rateLimit({ windowMs, max }: { windowMs: number; max: number }): RequestHandler {
  const buckets = new Map<string, number>();
  let window = 0;
  return (req, res, next) => {
    const current = Math.floor(Date.now() / windowMs);
    if (current !== window) { window = current; buckets.clear(); }
    const ip = req.ip ?? "unknown";
    const count = (buckets.get(ip) ?? 0) + 1;
    if (count > max || buckets.size > 10_000) { res.sendStatus(429); return; }
    buckets.set(ip, count);
    next();
  };
}

export function registerWebPush(app: Express) {
  const dataPath = process.env.MEETHAQ_PUSH_DATA?.trim();
  const runtimeKeys = process.env.MEETHAQ_PUSH_VAPID_JSON?.trim();
  const directory = dataPath ? resolve(dataPath) : undefined;
  if (directory) mkdirSync(directory, { recursive: true, mode: 0o700 });

  let vapid: ReturnType<typeof webPush.generateVAPIDKeys> | undefined;
  if (runtimeKeys) {
    try {
      // Some hosting dashboards normalize quoted JSON values from .env imports.
      // Accept an explicit base64url encoding so keys survive those parsers intact.
      const serializedKeys = runtimeKeys.startsWith("base64url:")
        ? Buffer.from(runtimeKeys.slice("base64url:".length), "base64url").toString("utf8")
        : runtimeKeys;
      const configured = vapidKeyPair.parse(JSON.parse(serializedKeys));
      const pair = createECDH("prime256v1");
      pair.setPrivateKey(Buffer.from(configured.privateKey, "base64url"));
      if (!pair.getPublicKey().equals(Buffer.from(configured.publicKey, "base64url"))) throw new Error("VAPID keys do not match");
      vapid = configured;
    }
    catch { console.warn("[Reminders] MEETHAQ_PUSH_VAPID_JSON is invalid. Push is disabled."); }
  } else if (directory) {
    const keyFile = join(directory, "vapid.json");
    try { vapid = JSON.parse(readFileSync(keyFile, "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      vapid = webPush.generateVAPIDKeys();
      writeFileSync(keyFile, JSON.stringify(vapid), { flag: "wx", mode: 0o600 });
    }
  }
  if (!vapid) {
    app.get("/api/reminders/config", (_req, res) => res.set("Cache-Control", "no-store").json({ available: false }));
    return;
  }
  const vapidDetails = { ...vapid, subject: process.env.MEETHAQ_PUSH_CONTACT || "https://meethaq.local" };
  const file = directory ? join(directory, "subscriptions.json") : undefined;
  let importing: Promise<void> | undefined;
  async function database() {
    const db = await getDb();
    if (!db) throw new Error("Push storage unavailable");
    if (file && directory && existsSync(file)) {
      importing ??= (async () => {
        const previous = z.array(legacyEntry).parse(JSON.parse(readFileSync(file, "utf8")));
        if (previous.length) await db.insert(pushDevices).values(previous.map(({ token, ...record }) => ({
          token, endpoint: record.subscription.endpoint, record,
        }))).onConflictDoNothing();
        try { renameSync(file, join(directory, "subscriptions.migrated.json")); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      })().catch(error => { importing = undefined; throw error; });
      await importing;
    }
    return db;
  }

  function device(row: { token: string; record: unknown } | undefined): Device | undefined {
    if (!row) return undefined;
    const parsed = recordSchema.safeParse(row.record);
    return parsed.success ? { token: row.token, record: parsed.data } : undefined;
  }
  const send = async (entry: Device, reminder: typeof TEST_REMINDER) => {
    const endpoint = entry.record.subscription.endpoint;
    try {
      await webPush.sendNotification(entry.record.subscription, JSON.stringify(reminder), { TTL: 90, timeout: 8000, vapidDetails });
      return true;
    } catch (error) {
      if ([404, 410].includes(Number((error as { statusCode?: number }).statusCode))) {
        const db = await database();
        await db.delete(pushDevices).where(and(eq(pushDevices.endpoint, endpoint), eq(pushDevices.token, entry.token)));
      }
      return false;
    }
  };
  const handle = (operation: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>): RequestHandler =>
    (req, res, next) => { void operation(req, res).catch(next); };

  app.get("/api/reminders/config", handle(async (_req, res) => {
    await database();
    res.set("Cache-Control", "no-store").json({ available: true, publicKey: vapidDetails.publicKey });
  }));
  app.use("/api/reminders", (req, res, next) => {
    const site = req.get("Sec-Fetch-Site");
    if ((site && site !== "same-origin" && site !== "none") || !req.is("application/json")) { res.sendStatus(403); return; }
    next();
  });
  app.put("/api/reminders/device", rateLimit({ windowMs: 60_000, max: 35 }), handle(async (req, res) => {
    const parsed = setup.safeParse(req.body);
    if (!parsed.success) { res.sendStatus(400); return; }
    const { token: presentedToken, ...submitted } = parsed.data;
    const endpoint = submitted.subscription.endpoint;
    const db = await database();
    const result = await db.transaction(async tx => {
      // Serialize registrations so new devices share the storage cap.
      await tx.execute(sql`select pg_advisory_xact_lock(80421734)`);
      const [row] = await tx.select().from(pushDevices).where(eq(pushDevices.endpoint, endpoint)).for("update");
      const current = device(row);
      if (row && (!current || (!(presentedToken && matches(current.token, presentedToken)) && current.record.subscription.keys.auth !== submitted.subscription.keys.auth))) return { status: 403 } as const;
      if (!row) {
        const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(pushDevices);
        if (count >= 5000) return { status: 503 } as const;
      }
      const token = current?.token ?? randomBytes(32).toString("base64url");
      const record = { ...submitted, sent: current?.record.sent ?? {} };
      await tx.insert(pushDevices).values({ endpoint, token, record }).onConflictDoUpdate({
        target: pushDevices.endpoint, set: { record, updatedAt: new Date() },
      });
      return { status: 200, token } as const;
    });
    if (result.status !== 200) { res.sendStatus(result.status); return; }
    res.set("Cache-Control", "no-store").json({ token: result.token });
  }));
  const access = z.object({ endpoint: z.string().max(2048), token: deviceToken });
  app.delete("/api/reminders/device", rateLimit({ windowMs: 60_000, max: 15 }), handle(async (req, res) => {
    const parsed = access.safeParse(req.body);
    if (!parsed.success) { res.sendStatus(400); return; }
    const db = await database();
    const [row] = await db.select({ token: pushDevices.token }).from(pushDevices).where(eq(pushDevices.endpoint, parsed.data.endpoint));
    if (row && !matches(row.token, parsed.data.token)) { res.sendStatus(403); return; }
    if (row) await db.delete(pushDevices).where(and(eq(pushDevices.endpoint, parsed.data.endpoint), eq(pushDevices.token, row.token)));
    res.sendStatus(204);
  }));
  app.post("/api/reminders/test", rateLimit({ windowMs: 60_000, max: 4 }), handle(async (req, res) => {
    const parsed = access.safeParse(req.body);
    if (!parsed.success) { res.sendStatus(403); return; }
    const db = await database();
    const [row] = await db.select().from(pushDevices).where(eq(pushDevices.endpoint, parsed.data.endpoint));
    const entry = device(row);
    if (!entry || !matches(entry.token, parsed.data.token)) { res.sendStatus(403); return; }
    res.sendStatus(await send(entry, TEST_REMINDER) ? 204 : 502);
  }));

  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const now = new Date();
      const current = now.getTime();
      const db = await database();
      const pending = (await db.select().from(pushDevices)).flatMap(row => {
        const entry = device(row);
        if (!entry) return [];
        return scheduleReminders(entry.record.prefs, entry.record.city, now).flatMap(reminder => {
          const dedup = reminder.key + ":" + reminder.at;
          return reminder.at <= current && reminder.at > current - 75_000 && !entry.record.sent[dedup]
            ? [{ row, entry, reminder, dedup }] : [];
        });
      });
      for (let index = 0; index < pending.length; index += 16) {
        await Promise.all(pending.slice(index, index + 16).map(async ({ row, entry, reminder, dedup }) => {
          const identity = and(eq(pushDevices.endpoint, row.endpoint), eq(pushDevices.token, row.token));
          const [claimed] = await db.update(pushDevices).set({
            record: sql`jsonb_set(${pushDevices.record}, '{sent}',
              coalesce((select jsonb_object_agg(key, value) from jsonb_each(${pushDevices.record}->'sent')
                where (value #>> '{}')::bigint >= ${current - 172_800_000}), '{}'::jsonb)
              || jsonb_build_object(${dedup}::text, ${current}::bigint))`,
          }).where(and(identity, eq(pushDevices.updatedAt, row.updatedAt),
            sql`not (${pushDevices.record}->'sent' ? ${dedup})`)).returning({ endpoint: pushDevices.endpoint });
          if (claimed && !await send(entry, reminder)) {
            await db.update(pushDevices).set({ record: sql`${pushDevices.record} #- array['sent', ${dedup}]::text[]` })
              .where(and(identity, sql`(${pushDevices.record}->'sent'->>${dedup})::bigint = ${current}`));
          }
        }));
      }
    } catch {
      console.warn("[Reminders] Scheduled delivery could not finish.");
    } finally { running = false; }
  }, 15_000);
  timer.unref();
}
