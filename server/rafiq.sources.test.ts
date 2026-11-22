import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const getRafiqSources = vi.hoisted(() => vi.fn());
const invokeLLM = vi.hoisted(() => vi.fn());
const consumeRafiqQuota = vi.hoisted(() => vi.fn());
vi.mock("./_core/rafiqSources", () => ({ getRafiqSources }));
vi.mock("./_core/llm", () => ({ invokeLLM }));
vi.mock("./db", () => ({ consumeRafiqQuota }));

const { appRouter } = await import("./routers");

const ctx: TrpcContext = {
  user: { id: 1, openId: "rafiq-test", name: "Test", email: "test@example.com", loginMethod: "password", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), emailVerified: true },
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};
const messages = [{ role: "user" as const, content: "كيف أبدأ التدبر؟" }];
const primary = { url: "https://publisher.example.com/article/1", title: "طرق التدبر", publisher: "ناشر خارجي", excerpt: "مقتطف اختباري للمراجعة." };

describe("Rafiq answers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRafiqSources.mockResolvedValue([]);
    consumeRafiqQuota.mockResolvedValue("ok");
  });

  it("blocks an account after its daily quota before external calls", async () => {
    consumeRafiqQuota.mockResolvedValue("user");
    await expect(appRouter.createCaller(ctx).rafiq.chat({ messages })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(getRafiqSources).not.toHaveBeenCalled();
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("blocks requests after the site-wide daily quota before external calls", async () => {
    consumeRafiqQuota.mockResolvedValue("global");
    await expect(appRouter.createCaller(ctx).rafiq.chat({ messages })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(getRafiqSources).not.toHaveBeenCalled();
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("shows only retrieved external references the answer actually cites", async () => {
    getRafiqSources.mockResolvedValue([primary, { ...primary, url: "https://other.example.org/2", publisher: "ناشر آخر" }]);
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: "إجابة اختبارية [مرجع ١] [مرجع 9]" } }] });
    const result = await appRouter.createCaller(ctx).rafiq.chat({ messages });
    expect(result).toEqual({
      answer: "إجابة اختبارية",
      sources: [{ title: primary.title, url: primary.url, publisher: primary.publisher }],
    });
    expect(invokeLLM.mock.calls[0]?.[0]?.messages?.[0]?.content).toContain(primary.excerpt);
  });

  it("returns a natural answer when search found no usable source", async () => {
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: "ابدأ بقراءة آيات قليلة بتمهل." } }] });
    const result = await appRouter.createCaller(ctx).rafiq.chat({ messages });
    expect(result).toEqual({ answer: "ابدأ بقراءة آيات قليلة بتمهل.", sources: [] });
  });

  it("rejects an empty provider response so the client can retry", async () => {
    getRafiqSources.mockResolvedValue([primary]);
    invokeLLM.mockResolvedValue({ choices: [{ finish_reason: "length", message: { content: " " } }] });
    await expect(appRouter.createCaller(ctx).rafiq.chat({ messages })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("keeps the previous question available when checking a follow-up", async () => {
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: "هذا شرح عام." } }] });
    await appRouter.createCaller(ctx).rafiq.chat({ messages: [
      ...messages, { role: "assistant", content: "اقرأ بتمهل." }, { role: "user", content: "هل أنت متأكد؟" },
    ] });
    expect(getRafiqSources).toHaveBeenCalledWith(["هل أنت متأكد؟", messages[0].content]);
  });

  it("keeps later steps of a detailed answer in context and preserves formatting", async () => {
    const previousAnswer = "## طريقة الاستخدام\n\n1. الشرح.\n2. " + "تفصيل ".repeat(120) + "الخطوة الأخيرة.";
    const answer = "### الخطوة الأخيرة\n\n1. **المقصود** هو مراجعة ما حفظته.\n2. جرّبها على آيات قليلة.";
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: answer } }] });
    const result = await appRouter.createCaller(ctx).rafiq.chat({ messages: [
      ...messages, { role: "assistant", content: previousAnswer }, { role: "user", content: "اشرح الخطوة الأخيرة." },
    ] });
    expect(invokeLLM.mock.calls[0]?.[0]?.messages).toContainEqual({ role: "assistant", content: previousAnswer });
    expect(result.answer).toBe(answer);
  });
});
