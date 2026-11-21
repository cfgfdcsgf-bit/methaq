import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Material } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

const db = vi.hoisted(() => ({
  createMaterials: vi.fn(),
  getMaterial: vi.fn(),
  updateMaterial: vi.fn(),
  listMaterials: vi.fn(),
  bulkUpdateStatus: vi.fn(),
  listCategories: vi.fn(),
  mergeProgress: vi.fn(),
}));

vi.mock("./db", () => db);

const { appRouter } = await import("./routers");

function context(role: "admin" | "owner"): TrpcContext {
  return {
    user: { id: 1, openId: `${role}-test`, name: "Test", email: `${role}@example.com`, loginMethod: "password", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), emailVerified: true },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const draft = {
  id: 7,
  kind: "sunnah" as const,
  title: "مادة اختبار",
  category: "اختبار",
  body: "نص اختبار موثق.",
  source: "مرجع اختباري",
  grade: "صحيح",
  status: "draft" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("content publishing policy", () => {
  const reviewed: Material = { ...draft, status: "review" };

  beforeEach(() => {
    vi.clearAllMocks();
    db.updateMaterial.mockImplementation(async (_id, _data, validate: (current: Material) => void) => {
      validate(reviewed);
      return true;
    });
  });

  it("rejects creating a published material directly", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.content.create({ ...draft, status: "published" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.createMaterials).not.toHaveBeenCalled();
  });

  it("requires a source before review", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.content.create({ ...draft, source: null, status: "review" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.createMaterials).not.toHaveBeenCalled();
  });

  it("allows an owner to publish only after review", async () => {
    const caller = appRouter.createCaller(context("owner"));
    await expect(caller.content.update({ id: draft.id, data: { status: "published" } })).resolves.toEqual({ ok: true });
    expect(db.updateMaterial).toHaveBeenCalledWith(draft.id, { status: "published" }, expect.any(Function), 1);
  });

  it("does not allow an admin to approve final publication", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.content.update({ id: draft.id, data: { status: "published" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not allow an admin to publish materials in bulk", async () => {
    db.bulkUpdateStatus.mockImplementation(async (_ids, _status, validate: (current: Material) => void) => {
      validate(reviewed);
      return 0;
    });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.content.bulkStatus({ ids: [draft.id], status: "published" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects clearing the source of a material in review", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.content.update({ id: draft.id, data: { source: null } })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("rejects publishing content changes in the same operation", async () => {
    const caller = appRouter.createCaller(context("owner"));
    await expect(caller.content.update({ id: draft.id, data: { status: "published", body: "تعديل" } })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("returns public hadith citations without the internal import identifier", async () => {
    db.listMaterials.mockResolvedValue([{ ...draft, status: "published", body: "أ".repeat(300) }]);
    const caller = appRouter.createCaller({ user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] });
    const result = await caller.content.list({ kind: "sunnah" });
    expect(result[0]).toMatchObject({ source: draft.source, grade: draft.grade });
    expect(result[0]).not.toHaveProperty("externalId");
    expect(result[0]?.body).toHaveLength(220);
  });

  it("lists published categories through the database without returning internal source metadata", async () => {
    db.listCategories.mockResolvedValue([{ category: "آداب", count: 4 }]);
    const caller = appRouter.createCaller({ user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] });
    await expect(caller.content.categories({ kind: "sunnah" })).resolves.toEqual([{ category: "آداب", count: 4 }]);
  });

  it("syncs only allowed progress keys for the authenticated user", async () => {
    const items = { quranPage: { v: "12", t: Date.now() } };
    db.mergeProgress.mockResolvedValue(items);
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.progress.sync({ items })).resolves.toEqual(items);
    expect(db.mergeProgress).toHaveBeenCalledWith(1, items);
  });

  it("rejects notification secrets and timestamps set in the future", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.progress.sync({ items: { "push-subscription-token": { v: "secret", t: Date.now() } } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.progress.sync({ items: { quranPage: { v: "12", t: Date.now() + 6 * 60 * 1000 } } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const oversized = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [`pr-2026-11-2${index}`, { v: "x".repeat(50_000), t: Date.now() }]));
    await expect(caller.progress.sync({ items: oversized })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.mergeProgress).not.toHaveBeenCalled();
  });
});
