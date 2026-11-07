import { boolean, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

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
  /** True once the address was proven by a provider (Google). Password sign-ups start unverified. */
  emailVerified: boolean("emailVerified").default(false).notNull(),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

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
  status: materialStatusEnum("status").default("draft").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});
export type Material = typeof materials.$inferSelect;
export type InsertMaterial = typeof materials.$inferInsert;
