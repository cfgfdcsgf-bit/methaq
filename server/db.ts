import { createHash } from "node:crypto";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { InsertMaterial, materials, InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
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
    const isOwner = user.openId === ENV.ownerOpenId || Boolean(ENV.ownerEmail && user.email && user.email.trim().toLowerCase() === ENV.ownerEmail);
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

export async function upsertGoogleUser(input: { subject: string; email: string; name: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const email = input.email.trim().toLowerCase();

  return db.transaction(async tx => {
    // Lock by normalized email so simultaneous first Google sign-ins cannot create duplicate accounts.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
    const existing = await tx.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (existing[0]) {
      const account = existing[0];
      const updates: Partial<InsertUser> = { lastSignedIn: new Date() };
      // Google proved who owns this address. A password set on an unverified account may belong to someone who
      // pre-registered with this email, so it is revoked; the real owner keeps access through Google.
      if (!account.emailVerified) {
        updates.emailVerified = true;
        if (account.passwordHash) updates.passwordHash = null;
      }
      if (!account.name && input.name) updates.name = input.name;
      if (ENV.ownerEmail && email === ENV.ownerEmail && account.role !== "owner") updates.role = "owner";
      const [updated] = await tx.update(users).set(updates).where(eq(users.id, account.id)).returning();
      return updated;
    }

    const openId = `google-${createHash("sha256").update(input.subject).digest("hex").slice(0, 57)}`;
    const [created] = await tx.insert(users).values({
      openId,
      name: input.name,
      email,
      loginMethod: "google",
      emailVerified: true,
      role: ENV.ownerEmail && email === ENV.ownerEmail ? "owner" : "user",
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
      if ((mayBecomeOwner || account.role === "owner") && !account.passwordHash) {
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

export async function listMaterials(o: { kind?: InsertMaterial["kind"]; q?: string; publishedOnly?: boolean; status?: InsertMaterial["status"]; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conds = [];
  if (o.kind) conds.push(eq(materials.kind, o.kind));
  if (o.publishedOnly) conds.push(eq(materials.status, "published"));
  if (o.status) conds.push(eq(materials.status, o.status));
  if (o.q) { const k = `%${o.q.replace(/[%_]/g, "")}%`; conds.push(or(ilike(materials.title, k), ilike(materials.body, k), ilike(materials.category, k))); }
  return db.select().from(materials).where(conds.length ? and(...conds) : undefined).orderBy(desc(materials.updatedAt)).limit(o.limit ?? 200);
}
export async function getMaterial(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
  return r[0];
}
export async function createMaterials(rows: InsertMaterial[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (rows.length) await db.insert(materials).values(rows);
  return rows.length;
}
export async function updateMaterial(id: number, data: Partial<InsertMaterial>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(materials).set(data).where(eq(materials.id, id));
}
export async function deleteMaterial(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(materials).where(eq(materials.id, id));
}
export async function materialStats() {
  const db = await getDb();
  if (!db) return { draft: 0, review: 0, published: 0 };
  const r = await db.select({ status: materials.status, n: sql<number>`count(*)` }).from(materials).groupBy(materials.status);
  const out = { draft: 0, review: 0, published: 0 };
  for (const x of r) out[x.status] = Number(x.n);
  return out;
}
