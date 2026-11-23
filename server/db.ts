import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  type InsertMaterial, type Material, materialAudit, materials, type InsertUser, users,
  authTokens, materialReports, rafiqUsage, userProgress,
} from "../drizzle/schema";
import { isSyncableProgressKey } from "../shared/progress";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
// In production a missing or broken database must fail loudly instead of rendering an empty site.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle({ connection: { connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 8_000 } });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  if (!_db && ENV.isProduction) throw new Error("Database is not available");
  return _db;
}

/** Readiness includes the schema that serving the current build requires. */
export async function dbHealthy() {
  try {
    const db = await getDb();
    if (!db) return false;
    await db.execute(sql`
      select (select "tokenVersion" from "users" limit 0),
             (select "archivedAt" from "materials" limit 0),
             (select "externalId" from "materials" limit 0),
             (select "id" from "material_audit" limit 0),
             (select "userId" from "user_progress" limit 0),
             (select "id" from "auth_tokens" limit 0),
             (select "count" from "rafiq_usage" limit 0),
             (select "id" from "material_reports" limit 0),
             (select "endpoint" from "push_devices" limit 0)
    `);
    return true;
  } catch {
    return false;
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    const isOwner = user.openId === ENV.ownerOpenId;
    if (isOwner) {
      values.role = "owner";
      updateSet.role = "owner";
    } else if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select().from(users).where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await requireDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export async function recordPasswordSignIn(openId: string, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [user] = await db.update(users).set({ lastSignedIn: new Date() })
    .where(and(eq(users.openId, openId), eq(users.passwordHash, passwordHash))).returning();
  return user;
}

export async function upsertGoogleUser(input: { subject: string; email: string; emailAuthoritative: boolean; name: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const email = input.email.trim().toLowerCase();
  const openId = `google-${createHash("sha256").update(input.subject).digest("hex").slice(0, 57)}`;
  const ownerEmailVerified = input.emailAuthoritative && Boolean(ENV.ownerEmail) && email === ENV.ownerEmail;

  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(1, hashtext(${openId}))`);
    const [linked] = await tx.select().from(users).where(eq(users.openId, openId)).limit(1);
    if (linked) {
      const updates: Partial<InsertUser> = { lastSignedIn: new Date() };
      if (!linked.name && input.name) updates.name = input.name;
      if (ownerEmailVerified) updates.role = "owner";
      const [updated] = await tx.update(users).set(updates).where(eq(users.id, linked.id)).returning();
      return updated;
    }

    if (input.emailAuthoritative) {
      // Local registration also takes this lock before examining the email.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
      const matches = await tx.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(2);
      const account = matches[0];
      if (account) {
        if (matches.length !== 1 || !account.openId.startsWith("local-")) {
          throw new Error("GOOGLE_ACCOUNT_LINK_CONFLICT");
        }
        // Rotating the identifier revokes sessions issued before Google verified the email.
        const [updated] = await tx.update(users).set({
          openId,
          name: account.name || input.name,
          loginMethod: "google",
          emailVerified: true,
          passwordHash: null,
          role: ownerEmailVerified ? "owner" : account.role,
          lastSignedIn: new Date(),
        }).where(eq(users.id, account.id)).returning();
        return updated;
      }
    }

    const [created] = await tx.insert(users).values({
      openId,
      name: input.name,
      email: input.emailAuthoritative ? email : null,
      loginMethod: "google",
      emailVerified: input.emailAuthoritative,
      role: ownerEmailVerified ? "owner" : "user",
      lastSignedIn: new Date(),
    }).returning();
    return created;
  });
}

export async function createLocalUser(input: { name: string; email: string; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const email = input.email.trim().toLowerCase();

  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
    // Serialize owner bootstrap so two simultaneous registrations cannot both become owners.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('meethaq-owner-bootstrap'))`);
    const existing = await tx.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    const owners = await tx.select({ id: users.id }).from(users).where(eq(users.role, "owner")).limit(1);
    const mayBecomeOwner = Boolean(ENV.ownerEmail) && email === ENV.ownerEmail && owners.length === 0;

    if (mayBecomeOwner && ENV.isProduction) {
      throw new Error("OWNER_BOOTSTRAP_DISABLED");
    }

    if (existing.length) {
      const account = existing[0];
      // A local development instance may add a local password to the configured owner's legacy row.
      if ((mayBecomeOwner || account.role === "owner") && !account.emailVerified && !account.passwordHash) {
        if (ENV.isProduction) throw new Error("OWNER_BOOTSTRAP_DISABLED");
        const [updated] = await tx.update(users).set({
          name: input.name || account.name,
          passwordHash: input.passwordHash,
          loginMethod: "password",
          role: "owner",
          lastSignedIn: new Date(),
        }).where(eq(users.id, account.id)).returning();
        return updated;
      }
      throw new Error("EMAIL_ALREADY_REGISTERED");
    }

    const openId = `local-${createHash("sha256").update(email).digest("hex").slice(0, 58)}`;
    const [created] = await tx.insert(users).values({
      openId,
      name: input.name,
      email,
      passwordHash: input.passwordHash,
      loginMethod: "password",
      emailVerified: false,
      role: mayBecomeOwner ? "owner" : "user",
      lastSignedIn: new Date(),
    }).returning();
    return created;
  });
}

export async function listUsersForOwner() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    loginMethod: users.loginMethod,
    role: users.role,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.update(users).set({ role }).where(and(eq(users.id, id), sql`${users.role} <> 'owner'`)).returning({ id: users.id });
  return result.length > 0;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ---------------------------------------------------------------------------
// One-time email links (verification and password reset)
// ---------------------------------------------------------------------------

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a token for the user and returns the raw value to email. Earlier unused tokens of the same type are voided. */
export async function createAuthToken(userId: number, type: "verify-email" | "reset-password", ttlMs: number) {
  const db = await requireDb();
  const token = randomBytes(32).toString("base64url");
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(3, ${userId})`);
    await tx.update(authTokens).set({ usedAt: new Date() })
      .where(and(eq(authTokens.userId, userId), eq(authTokens.type, type), sql`${authTokens.usedAt} is null`));
    await tx.insert(authTokens).values({ userId, type, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + ttlMs) });
  });
  return token;
}

export async function applyAuthToken(token: string, action: { type: "verify-email" } | { type: "reset-password"; passwordHash: string }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [row] = await tx.update(authTokens).set({ usedAt: new Date() })
      .where(and(eq(authTokens.tokenHash, tokenHash(token)), eq(authTokens.type, action.type),
        isNull(authTokens.usedAt), sql`${authTokens.expiresAt} > now()`)).returning({ userId: authTokens.userId });
    if (!row) return false;
    const changes = action.type === "verify-email" ? { emailVerified: true } : {
      emailVerified: true,
      passwordHash: action.passwordHash,
      loginMethod: sql`coalesce(${users.loginMethod}, 'password')`,
      tokenVersion: sql`${users.tokenVersion} + 1`,
    };
    await tx.update(users).set(changes).where(eq(users.id, row.userId));
    return true;
  });
}

// ---------------------------------------------------------------------------
// Rafiq daily quota
// ---------------------------------------------------------------------------

class QuotaExceeded extends Error {
  constructor(readonly scope: "user" | "global") { super(scope); }
}

/** Counts one Rafiq question for the user and for the whole site. Returns which ceiling was hit, if any. */
export async function consumeRafiqQuota(userId: number, perUser: number, global: number): Promise<"ok" | "user" | "global"> {
  const db = await requireDb();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  try {
    await db.transaction(async tx => {
      const take = async (id: number, limit: number) => {
        const result = await tx.execute(sql`
          insert into ${rafiqUsage} ("userId", "day", "count") values (${id}, ${day}, 1)
          on conflict ("userId", "day") do update set "count" = ${rafiqUsage}."count" + 1
          where ${rafiqUsage}."count" < ${limit}
          returning "count"`);
        return result.rows.length > 0;
      };
      if (!(await take(userId, perUser))) throw new QuotaExceeded("user");
      if (!(await take(0, global))) throw new QuotaExceeded("global");
    });
    return "ok";
  } catch (error) {
    if (error instanceof QuotaExceeded) return error.scope;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Synced reader progress
// ---------------------------------------------------------------------------

export type ProgressMap = Record<string, { v: string; t: number }>;

function cleanProgress(value: unknown): ProgressMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const candidates = Object.entries(value as Record<string, unknown>).flatMap(([key, raw]) => {
    if (!isSyncableProgressKey(key) || !raw || typeof raw !== "object") return [];
    const entry = raw as { v?: unknown; t?: unknown };
    if (typeof entry.v !== "string" || entry.v.length > 50_000 || !Number.isSafeInteger(entry.t) || (entry.t as number) < 0 || (entry.t as number) > Date.now() + 5 * 60 * 1000) return [];
    return [[key, { v: entry.v, t: entry.t as number }] as const];
  }).sort((a, b) => b[1].t - a[1].t);
  const clean: ProgressMap = {};
  let bytes = 0;
  for (const [key, entry] of candidates) {
    const size = Buffer.byteLength(entry.v, "utf8");
    if (Object.keys(clean).length >= 300 || bytes + size > 200_000) continue;
    clean[key] = entry;
    bytes += size;
  }
  return clean;
}

export async function getProgress(userId: number): Promise<ProgressMap> {
  const db = await requireDb();
  const [row] = await db.select().from(userProgress).where(eq(userProgress.userId, userId)).limit(1);
  return cleanProgress(row?.data);
}

/** Merges per key, newest timestamp wins, and returns the merged map. */
export async function mergeProgress(userId: number, incoming: ProgressMap): Promise<ProgressMap> {
  const db = await requireDb();
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(2, ${userId})`);
    const [row] = await tx.select().from(userProgress).where(eq(userProgress.userId, userId)).for("update").limit(1);
    const merged: ProgressMap = cleanProgress(row?.data);
    for (const [key, entry] of Object.entries(cleanProgress(incoming))) {
      if (!merged[key] || entry.t > merged[key].t) merged[key] = entry;
    }
    const safeMerged = cleanProgress(merged);
    await tx.insert(userProgress).values({ userId, data: safeMerged, updatedAt: new Date() })
      .onConflictDoUpdate({ target: userProgress.userId, set: { data: safeMerged, updatedAt: new Date() } });
    return safeMerged;
  });
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

type MaterialFilter = { kind?: InsertMaterial["kind"]; category?: string; q?: string; publishedOnly?: boolean; status?: InsertMaterial["status"]; archived?: boolean };

function materialConditions(o: MaterialFilter) {
  const conds = [o.archived ? isNotNull(materials.archivedAt) : isNull(materials.archivedAt)];
  if (o.kind) conds.push(eq(materials.kind, o.kind));
  if (o.category) conds.push(eq(materials.category, o.category));
  if (o.publishedOnly) conds.push(eq(materials.status, "published"));
  if (o.status) conds.push(eq(materials.status, o.status));
  if (o.q) {
    const term = `%${o.q.replace(/[\\%_]/g, "\\$&")}%`;
    conds.push(or(ilike(materials.title, term), ilike(materials.body, term), ilike(materials.category, term))!);
  }
  return conds.length ? and(...conds) : undefined;
}

export async function listMaterials(o: MaterialFilter & { limit?: number; offset?: number }) {
  const db = await requireDb();
  const sort = o.category ? [materials.id] : [desc(materials.updatedAt), desc(materials.id)];
  return db.select().from(materials).where(materialConditions(o)).orderBy(...sort).limit(o.limit ?? 200).offset(o.offset ?? 0);
}

/** Admin screen: filtered, paged and counted, so thousands of materials stay manageable. */
export async function searchMaterialsAdmin(o: MaterialFilter & { limit: number; offset: number }) {
  const db = await requireDb();
  const where = materialConditions(o);
  const [items, [total]] = await Promise.all([
    db.select().from(materials).where(where).orderBy(desc(materials.updatedAt), desc(materials.id)).limit(o.limit).offset(o.offset),
    db.select({ n: sql<number>`count(*)` }).from(materials).where(where),
  ]);
  return { items, total: Number(total?.n ?? 0) };
}

/** Distinct published categories with counts; drives the category chips on public pages. */
export async function listCategories(kind: InsertMaterial["kind"]) {
  const db = await requireDb();
  const rows = await db.select({ category: materials.category, n: sql<number>`count(*)` }).from(materials)
    .where(and(eq(materials.kind, kind), eq(materials.status, "published"), isNull(materials.archivedAt), isNotNull(materials.category)))
    .groupBy(materials.category).orderBy(desc(sql`count(*)`), asc(materials.category));
  return rows.flatMap(row => row.category ? [{ category: row.category, count: Number(row.n) }] : []);
}

export async function getMaterial(id: number) {
  const db = await requireDb();
  const r = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
  return r[0];
}

export async function dailyHadith(day: number) {
  const db = await requireDb();
  const published = and(eq(materials.kind, "sunnah"), eq(materials.status, "published"), isNull(materials.archivedAt),
    sql`nullif(trim(${materials.source}), '') is not null`, sql`nullif(trim(${materials.grade}), '') is not null`);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(materials).where(published);
  if (!count) return null;
  const [item] = await db.select().from(materials).where(published).orderBy(materials.id).offset(day % count).limit(1);
  return item ?? null;
}

export async function createMaterials(rows: InsertMaterial[], actorId?: number | null, action: "create" | "import" = "create") {
  const db = await requireDb();
  if (!rows.length) return 0;
  await db.transaction(async tx => {
    const created = await tx.insert(materials).values(rows).returning();
    await tx.insert(materialAudit).values(created.map(material => ({
      materialId: material.id, actorId: actorId ?? null, action, before: null, after: material,
    })));
  });
  return rows.length;
}

export async function updateMaterial(id: number, data: Partial<InsertMaterial>, validate: (current: Material) => void, actorId?: number | null) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [current] = await tx.select().from(materials).where(eq(materials.id, id)).for("update");
    if (!current || current.archivedAt) return false;
    validate(current);
    if (Object.keys(data).length > 0) {
      const [updated] = await tx.update(materials).set(data).where(eq(materials.id, id)).returning();
      await tx.insert(materialAudit).values({
        materialId: id, actorId: actorId ?? null,
        action: data.status && data.status !== current.status ? "status" : "update",
        before: current, after: updated,
      });
    }
    return true;
  });
}

/** Moves several materials to one status. Every item is validated; the whole batch fails if one is not allowed. */
export async function bulkUpdateStatus(ids: number[], status: InsertMaterial["status"], validate: (current: Material) => void, actorId?: number | null) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const current = await tx.select().from(materials).where(and(inArray(materials.id, ids), isNull(materials.archivedAt))).orderBy(materials.id).for("update");
    for (const material of current) validate(material);
    const changing = current.filter(material => material.status !== status);
    if (!changing.length) return 0;
    const updated = await tx.update(materials).set({ status }).where(inArray(materials.id, changing.map(material => material.id))).returning();
    const byId = new Map(updated.map(material => [material.id, material]));
    await tx.insert(materialAudit).values(changing.map(before => ({
      materialId: before.id, actorId: actorId ?? null, action: "status", before, after: byId.get(before.id) ?? null,
    })));
    return changing.length;
  });
}

export async function setMaterialArchived(id: number, archived: boolean, actorId: number) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [before] = await tx.select().from(materials).where(eq(materials.id, id)).for("update");
    if (!before) return false;
    if (Boolean(before.archivedAt) === archived) return true;
    const [after] = await tx.update(materials).set(archived ? { archivedAt: new Date() } : {
      archivedAt: null, status: before.source?.trim() ? "review" : "draft",
    }).where(eq(materials.id, id)).returning();
    await tx.insert(materialAudit).values({ materialId: id, actorId, action: archived ? "archive" : "restore", before, after });
    return true;
  });
}

export async function reportMaterial(id: number, userId: number, message: string) {
  const db = await requireDb();
  return db.transaction(async tx => {
    // Serialize this account's submissions so parallel requests share the same limit.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(materialReports)
      .where(and(eq(materialReports.reporterId, userId), sql`${materialReports.createdAt} > now() - interval '1 day'`));
    if (count >= 5) return "limit" as const;
    const [material] = await tx.select({ id: materials.id }).from(materials)
      .where(and(eq(materials.id, id), isNull(materials.archivedAt), eq(materials.status, "published")));
    if (!material) return "missing" as const;
    await tx.insert(materialReports).values({ materialId: id, reporterId: userId, message });
    return "sent" as const;
  });
}

export async function pendingMaterialReports() {
  const db = await requireDb();
  return db.select({ id: materialReports.id, materialId: materialReports.materialId, title: materials.title, message: materialReports.message })
    .from(materialReports).innerJoin(materials, eq(materials.id, materialReports.materialId))
    .where(isNull(materialReports.resolvedAt)).orderBy(materialReports.createdAt, materialReports.id).limit(50);
}

export async function resolveMaterialReport(id: number) {
  const db = await requireDb();
  await db.update(materialReports).set({ resolvedAt: new Date() }).where(and(eq(materialReports.id, id), isNull(materialReports.resolvedAt)));
}

export async function materialHistory(id: number) {
  const db = await requireDb();
  const rows = await db.select({
    id: materialAudit.id, action: materialAudit.action, actorId: materialAudit.actorId, createdAt: materialAudit.createdAt,
    before: materialAudit.before, after: materialAudit.after, actorName: users.name, actorEmail: users.email,
  }).from(materialAudit).leftJoin(users, eq(users.id, materialAudit.actorId))
    .where(eq(materialAudit.materialId, id)).orderBy(desc(materialAudit.createdAt), desc(materialAudit.id)).limit(50);
  const fields = ["kind", "title", "category", "body", "source", "grade", "status"] as const;
  return rows.map(row => {
    const before = (row.before ?? {}) as Record<string, unknown>;
    const after = (row.after ?? {}) as Record<string, unknown>;
    const changes = fields.flatMap(field => before[field] !== after[field] ? [{ field, from: before[field] ?? null, to: after[field] ?? null }] : []);
    return {
      id: row.id, action: row.action, at: row.createdAt,
      actor: row.actorName || row.actorEmail || (row.actorId ? `#${row.actorId}` : "النظام"),
      changes: ["update", "status", "restore"].includes(row.action) ? changes : [],
    };
  });
}

export async function materialStats() {
  const db = await requireDb();
  const r = await db.select({ status: materials.status, n: sql<number>`count(*)` }).from(materials).where(isNull(materials.archivedAt)).groupBy(materials.status);
  const out = { draft: 0, review: 0, published: 0 };
  for (const x of r) out[x.status] = Number(x.n);
  return out;
}
