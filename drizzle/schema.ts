import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Columns use camelCase to match both database fields and generated types.
 */
export const roleEnum = pgEnum("role", ["user", "admin", "owner"]);

export const users = pgTable("users", {
  /** Surrogate primary key. Auto-incremented numeric value managed by the database. */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  /** Scrypt hash for local email/password accounts; OAuth-only accounts leave it null. */
  passwordHash: text("passwordHash"),
  /** True once the address was proven by a provider (Google) or by an emailed link. Password sign-ups start unverified. */
  emailVerified: boolean("emailVerified").default(false).notNull(),
  /** Bumped on password reset so every session issued before it stops working. */
  tokenVersion: integer("tokenVersion").default(0).notNull(),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  // One account per address, whatever the letter case.
  uniqueIndex("users_email_lower_idx").on(sql`lower(${table.email})`).where(sql`${table.email} is not null`),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const MATERIAL_KINDS = ["quran", "sunnah", "library", "learning", "adhkar"] as const;
export const MATERIAL_STATUSES = ["draft", "review", "published"] as const;
export const materialKindEnum = pgEnum("material_kind", MATERIAL_KINDS);
export const materialStatusEnum = pgEnum("material_status", MATERIAL_STATUSES);

export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  kind: materialKindEnum("kind").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 120 }),
  body: text("body").notNull(),
  source: varchar("source", { length: 255 }),
  grade: varchar("grade", { length: 120 }),
  /** Stable id in the upstream dataset (for example `hadeethenc:123`). Makes imports idempotent. */
  externalId: varchar("externalId", { length: 120 }),
  status: materialStatusEnum("status").default("draft").notNull(),
  archivedAt: timestamp("archivedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [
  uniqueIndex("materials_external_id_idx").on(table.externalId).where(sql`${table.externalId} is not null`),
  index("materials_kind_status_idx").on(table.kind, table.status),
  index("materials_kind_category_idx").on(table.kind, table.category),
  index("materials_updated_idx").on(table.updatedAt),
]);
export type Material = typeof materials.$inferSelect;
export type InsertMaterial = typeof materials.$inferInsert;

/** Who changed which material and how. Keeps full snapshots so a deleted or overwritten material can be restored by hand. */
export const materialAudit = pgTable("material_audit", {
  id: serial("id").primaryKey(),
  /** Not a foreign key on purpose: the trail must outlive a deleted material. */
  materialId: integer("materialId").notNull(),
  actorId: integer("actorId"),
  action: varchar("action", { length: 24 }).notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  index("material_audit_material_idx").on(table.materialId, table.createdAt),
]);
export type MaterialAudit = typeof materialAudit.$inferSelect;

export const materialReports = pgTable("material_reports", {
  id: serial("id").primaryKey(),
  materialId: integer("materialId").notNull().references(() => materials.id),
  reporterId: integer("reporterId").references(() => users.id, { onDelete: "set null" }),
  message: varchar("message", { length: 1000 }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
}, table => [index("material_reports_pending_idx").on(table.resolvedAt, table.createdAt)]);

/** Device-independent copy of the reader's local progress (khatma, favourites, tasbih, prayer log). */
export const userProgress = pgTable("user_progress", {
  userId: integer("userId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  /** `{ [localStorageKey]: { v: string, t: epochMs } }` */
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

/** One-time links for email verification and password reset. Only the SHA-256 of the token is stored. */
export const authTokens = pgTable("auth_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 24 }).notNull(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  usedAt: timestamp("usedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  index("auth_tokens_user_type_idx").on(table.userId, table.type),
]);

/** Daily Rafiq question counter. userId 0 holds the site-wide counter. */
export const rafiqUsage = pgTable("rafiq_usage", {
  userId: integer("userId").notNull(),
  day: varchar("day", { length: 10 }).notNull(),
  count: integer("count").notNull().default(0),
}, table => [
  primaryKey({ columns: [table.userId, table.day] }),
]);

export const pushDevices = pgTable("push_devices", {
  endpoint: text("endpoint").primaryKey(),
  token: text("token").notNull(),
  record: jsonb("record").notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
