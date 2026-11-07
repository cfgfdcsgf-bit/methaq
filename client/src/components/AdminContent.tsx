import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { KINDS, type Kind } from "./ContentPage";
import { useAuth } from "@/_core/hooks/useAuth";

type Status = "draft" | "review" | "published";
const STATUS: Record<Status, string> = { draft: "مسودة", review: "قيد المراجعة", published: "منشورة" };
type Form = { id?: number; kind: Kind; title: string; category: string; body: string; source: string; grade: string; status: Status };
const blank = (kind: Kind): Form => ({ kind, title: "", category: "", body: "", source: "", grade: "", status: "draft" });

export default function AdminContent() {
  const { user } = useAuth();
  const [kind, setKind] = useState<Kind>("quran");
  const [status, setStatus] = useState<Status | "">("");
  const [form, setForm] = useState<Form | null>(null);
  const [importing, setImporting] = useState(false);
  const [json, setJson] = useState("");
  const utils = trpc.useUtils();
  const stats = trpc.content.stats.useQuery();
  const list = trpc.content.adminList.useQuery({ kind, status: status || undefined });
  const refresh = () => { utils.content.adminList.invalidate(); utils.content.stats.invalidate(); utils.content.list.invalidate(); };
  const onErr = (e: { message: string }) => toast.error(e.message || "حدث خطأ");
  const create = trpc.content.create.useMutation({ onSuccess: () => { toast.success("تمت الإضافة"); setForm(null); refresh(); }, onError: onErr });
  const update = trpc.content.update.useMutation({ onSuccess: () => { toast.success("تم الحفظ"); setForm(null); refresh(); }, onError: onErr });
  const remove = trpc.content.remove.useMutation({ onSuccess: () => { toast.success("تم الحذف"); refresh(); }, onError: onErr });
  const many = trpc.content.importMany.useMutation({ onSuccess: r => { toast.success(`تم استيراد ${r.count} مادة`); setImporting(false); setJson(""); refresh(); }, onError: onErr });

  const edit = async (id: number) => { const m = await utils.content.adminGet.fetch({ id }); if (m) setForm({ id: m.id, kind: m.kind, title: m.title, category: m.category ?? "", body: m.body, source: m.source ?? "", grade: m.grade ?? "", status: m.status === "published" ? "review" : m.status }); };
  const save = () => { if (!form) return; const { id, ...d } = form; const data = { ...d, category: d.category || null, source: d.source || null, grade: d.grade || null }; id ? update.mutate({ id, data }) : create.mutate(data); };
  const doImport = () => { try { const items = JSON.parse(json); many.mutate({ items: (Array.isArray(items) ? items : [items]).map((x: any) => ({ kind, status: "draft", ...x })) }); } catch { toast.error("صيغة JSON غير صحيحة"); } };
  const set = (k: keyof Form, v: string) => setForm(f => f && { ...f, [k]: v });
  const s = stats.data ?? { draft: 0, review: 0, published: 0 };

  return <>
    <div className="stats-grid"><div><span>منشورة</span><b>{s.published}</b><small>ظاهرة للزوار</small></div><div><span>قيد المراجعة</span><b>{s.review}</b><small>تنتظر الاعتماد</small></div><div><span>مسودات</span><b>{s.draft}</b><small>لا تظهر للجمهور</small></div></div>
    <div className="admin-controls">
      <div className="table-title"><div><span className="kicker">إدارة المحتوى</span><h2>المواد</h2></div><div className="admin-actions"><button className="detail-btn" onClick={() => setImporting(true)}><Upload size={15} /> استيراد JSON</button><button className="detail-btn primary-detail" onClick={() => setForm(blank(kind))}><Plus size={15} /> إضافة مادة</button></div></div>
      <div className="admin-filters"><div className="chips">{(Object.keys(KINDS) as Kind[]).map(k => <button key={k} className={kind === k ? "active" : ""} onClick={() => setKind(k)}>{KINDS[k].label}</button>)}</div><select value={status} onChange={e => setStatus(e.target.value as Status | "")} aria-label="الحالة"><option value="">كل الحالات</option>{(Object.keys(STATUS) as Status[]).map(k => <option key={k} value={k}>{STATUS[k]}</option>)}</select></div>
      <div className="admin-list">{list.isLoading ? <div className="skeleton" /> : (list.data ?? []).length === 0 ? <p className="empty-state-light">لا توجد مواد هنا بعد. اضغط «إضافة مادة».</p> : (list.data ?? []).map(m => <div key={m.id} className="admin-row"><div><b>{m.title}</b><small>{m.category || "بدون تصنيف"}</small></div><select className={`st st-${m.status}`} value={m.status} aria-label="تغيير الحالة" onChange={e => update.mutate({ id: m.id, data: { status: e.target.value as Status } })}>{(Object.keys(STATUS) as Status[]).filter(k => user?.role === "owner" || k !== "published" || m.status === "published").map(k => <option key={k} value={k} disabled={k === "published" && user?.role !== "owner"}>{STATUS[k]}</option>)}</select><button className="icon-btn" aria-label="تعديل" onClick={() => edit(m.id)}><Pencil size={17} /></button><button className="icon-btn danger" aria-label="حذف" onClick={() => confirm("حذف هذه المادة نهائيًا؟") && remove.mutate({ id: m.id })}><Trash2 size={17} /></button></div>)}</div>
    </div>
    {form && <div className="modal-back" onClick={() => setForm(null)}><div className="modal form-modal" role="dialog" aria-modal onClick={e => e.stopPropagation()}>
      <div className="modal-head"><h2>{form.id ? "تعديل مادة" : "مادة جديدة"}</h2><button className="icon-btn" aria-label="إغلاق" onClick={() => setForm(null)}><X size={20} /></button></div>
      <div className="form-grid">
        <label>القسم<select value={form.kind} onChange={e => set("kind", e.target.value)}>{(Object.keys(KINDS) as Kind[]).map(k => <option key={k} value={k}>{KINDS[k].label}</option>)}</select></label>
        <label>الحالة<select value={form.status} onChange={e => set("status", e.target.value)}>{(["draft", "review"] as Status[]).map(k => <option key={k} value={k}>{STATUS[k]}</option>)}</select></label>
        {form.id && <p className="review-edit-note">تعديل المادة المنشورة يعيدها تلقائيًا إلى المراجعة؛ يعتمد المالك نشر النسخة المحدّثة.</p>}
        <label className="wide">العنوان<input value={form.title} onChange={e => set("title", e.target.value)} /></label>
        <label>التصنيف<input value={form.category} onChange={e => set("category", e.target.value)} placeholder="مثال: أذكار الصباح" /></label>
        <label>مرجع المراجعة الداخلي<input value={form.source} onChange={e => set("source", e.target.value)} placeholder="للمراجعة الداخلية فقط" /></label>
        <label className="wide">الدرجة (اختياري)<input value={form.grade} onChange={e => set("grade", e.target.value)} placeholder="صحيح، حسن…" /></label>
        <label className="wide">النص<textarea rows={9} value={form.body} onChange={e => set("body", e.target.value)} /></label>
      </div>
      <div className="modal-foot"><button className="detail-btn" onClick={() => setForm(null)}>إلغاء</button><button className="detail-btn primary-detail" disabled={!form.title.trim() || !form.body.trim() || create.isPending || update.isPending} onClick={save}>حفظ</button></div>
    </div></div>}
    {importing && <div className="modal-back" onClick={() => setImporting(false)}><div className="modal form-modal" role="dialog" aria-modal onClick={e => e.stopPropagation()}>
      <div className="modal-head"><h2>استيراد جماعي</h2><button className="icon-btn" aria-label="إغلاق" onClick={() => setImporting(false)}><X size={20} /></button></div>
      <p className="hint">الصق مصفوفة JSON. كل عنصر: <code>{`{"title":"…","body":"…","category":"…","source":"…"}`}</code>. تُضاف العناصر المستوردة كمسودات؛ أرسلها للمراجعة بعد التحقق من النص.</p>
      <textarea className="json-box" rows={10} dir="ltr" value={json} onChange={e => setJson(e.target.value)} />
      <div className="modal-foot"><button className="detail-btn" onClick={() => setImporting(false)}>إلغاء</button><button className="detail-btn primary-detail" disabled={!json.trim() || many.isPending} onClick={doImport}>استيراد</button></div>
    </div></div>}
  </>;
}
