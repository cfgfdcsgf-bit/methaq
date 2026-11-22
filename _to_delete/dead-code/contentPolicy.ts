import { TRPCError } from "@trpc/server";
import type { InsertMaterial, Material } from "../drizzle/schema";

const CONTENT_FIELDS = ["kind", "title", "category", "body", "source", "grade"] as const;
const fail = (code: "PRECONDITION_FAILED" | "FORBIDDEN", message: string): never => { throw new TRPCError({ code, message }); };

/**
 * The single place that decides whether a material may move to the requested state.
 * Shared by the one-off update and by bulk actions so both enforce the same publishing policy.
 */
export function validateMaterialUpdate(current: Material, data: Partial<InsertMaterial>, role: string) {
  const contentChanged = CONTENT_FIELDS.some(field => data[field] !== undefined && data[field] !== current[field]);
  const nextStatus = data.status ?? current.status;
  const nextSource = data.source === undefined ? current.source : data.source;

  if (current.status === "published" && contentChanged && nextStatus !== "review") {
    fail("PRECONDITION_FAILED", "أعد المادة المنشورة إلى المراجعة قبل تعديل محتواها.");
  }
  if (nextStatus === "review" && !nextSource?.trim()) {
    fail("PRECONDITION_FAILED", "أضف مصدر المادة قبل إرسالها للمراجعة.");
  }
  if (nextStatus === "published" && current.status !== "published") {
    if (current.status !== "review") fail("PRECONDITION_FAILED", "يجب أن تمر المادة بالمراجعة قبل نشرها.");
    if (role !== "owner") fail("FORBIDDEN", "اعتماد النشر النهائي متاح لمالك الموقع.");
    if (!nextSource?.trim()) fail("PRECONDITION_FAILED", "لا يمكن نشر مادة بلا مصدر.");
    if (contentChanged) fail("PRECONDITION_FAILED", "احفظ التعديلات في المراجعة أولًا، ثم اعتمد النسخة المحفوظة للنشر.");
  }
}
