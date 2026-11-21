import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import "./admin-content.css";
import { Archive, History, Pencil, Plus, RotateCcw, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KINDS, type Kind } from "./ContentPage";
import { useAuth } from "@/_core/hooks/useAuth";

type Status = "draft" | "review" | "published";
const PAGE_SIZE = 50;
const STATUS: Record<Status, string> = { draft: "مسودة", review: "قيد المراجعة", published: "منشورة" };
type Form = { id?: number; kind: Kind; title: string; category: string; body: string; source: string; grade: string; status: Status };
const blank = (kind: Kind): Form => ({ kind, title: "", category: "", body: "", source: "", grade: "", status: "draft" });

export default function AdminContent() {
  const { user } = useAuth();
  const [kind, setKind] = useState<Kind>("quran");
  const [archived, setArchived] = useState(false);
  const [status, setStatus] = useState<Status | "">("");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<Status | "">("");
  const [form, setForm] = useState<Form | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [json, setJson] = useState("");
  const utils = trpc.useUtils();
  const stats = trpc.content.stats.useQuery();
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchText.trim()); setPage(0); setSelectedIds([]); }, 250);
    return () => window.clearTimeout(timer);
  }, [searchText]);
  const list = trpc.content.adminList.useQuery({ kind, archived, status: status || undefined, q: search || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const history = trpc.content.history.useQuery({ id: historyId ?? 0 }, { enabled: historyId !== null });
  const refresh = () => { void utils.content.invalidate(); };
  const onErr = (e: { message: string }) => toast.error(e.message || "حدث خطأ");
  const create = trpc.content.create.useMutation({ onSuccess: () => { toast.success("تمت الإضافة"); setForm(null); refresh(); }, onError: onErr });
  const update = trpc.content.update.useMutation({ onSuccess: () => { toast.success("تم الحفظ"); setForm(null); refresh(); }, onError: onErr });
  const archive = trpc.content.setArchived.useMutation({ onSuccess: (_data, variables) => { toast.success(variables.archived ? "نُقلت المادة إلى الأرشيف" : "استُعيدت المادة وتحتاج اعتمادًا للنشر"); if (rows.length === 1 && page > 0) setPage(page - 1); refresh(); }, onError: onErr });
  const reports = trpc.content.reports.useQuery();
  const resolve = trpc.content.resolveReport.useMutation({ onSuccess: () => void utils.content.reports.invalidate(), onError: onErr });
  const many = trpc.content.importMany.useMutation({ onSuccess: r => { toast.success(`تم استيراد ${r.count} مادة`); setImporting(false); setJson(""); refresh(); }, onError: onErr });
  const bulk = trpc.content.bulkStatus.useMutation({ onSuccess: r => { toast.success(`تم تحديث ${r.count} مادة`); setSelectedIds([]); setSelectedStatus(""); refresh(); }, onError: onErr });

  const edit = async (id: number) => { const m = await utils.content.adminGet.fetch({ id }); if (m) setForm({ id: m.id, kind: m.kind, title: m.title, category: m.category ?? "", body: m.body, source: m.source ?? "", grade: m.grade ?? "", status: m.status === "published" ? "review" : m.status }); };
  const save = () => { if (!form) return; const { id, ...d } = form; const data = { ...d, category: d.category || null, source: d.source || null, grade: d.grade || null }; id ? update.mutate({ id, data }) : create.mutate(data); };
  const doImport = () => { try { const items = JSON.parse(json); many.mutate({ items: (Array.isArray(items) ? items : [items]).map((x: any) => ({ kind, status: "draft", ...x })) }); } catch { toast.error("صيغة JSON غير صحيحة"); } };
  const set = (k: keyof Form, v: string) => setForm(f => f && { ...f, [k]: v });
  const s = stats.data ?? { draft: 0, review: 0, published: 0 };

  return <>
    <details className="admin-controls"><summary>بلاغات المحتوى {reports.data ? `(${reports.data.length})` : ""}</summary>
      {reports.isError ? <button type="button" onClick={() => void reports.refetch()}>إعادة تحميل البلاغات</button>
        : reports.isLoading ? <p>جارٍ التحميل…</p> : !reports.data?.length ? <p>لا توجد بلاغات مفتوحة.</p>
        : <ul>{reports.data.map(report => <li key={report.id}><b>{report.title}</b><p>{report.message}</p>
          <button type="button" className="detail-btn" onClick={() => void edit(report.materialId)}>افتح المادة</button>
          <button type="button" className="detail-btn" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: report.id })}>تمت المراجعة</button>
        </li>)}</ul>}
    </details>
    <div className="stats-grid"><div><span>منشورة</span><b>{s.published}</b><small>ظاهرة للزوار</small></div><div><span>قيد المراجعة</span><b>{s.review}</b><small>تنتظر الاعتماد</small></div><div><span>مسودات</span><b>{s.draft}</b><small>لا تظهر للجمهور</small></div></div>
    <div className="admin-controls">
      <div className="table-title"><div><span className="kicker">إدارة المحتوى</span><h2>المواد</h2></div><div className="admin-actions"><button className="detail-btn" onClick={() => setImporting(true)}><Upload size={15} /> استيراد JSON</button><button className="detail-btn primary-detail" onClick={() => setForm(blank(kind))}><Plus size={15} /> إضافة مادة</button></div></div>
      <div className="admin-filters"><div className="chips">{(Object.keys(KINDS) as Kind[]).map(k => <button key={k} className={kind === k ? "active" : ""} onClick={() => { setKind(k); setPage(0); setSelectedIds([]); }}>{KINDS[k].label}</button>)}</div><select value={status} onChange={e => { setStatus(e.target.value as Status | ""); setPage(0); setSelectedIds([]); }} aria-label="الحالة"><option value="">كل الحالات</option>{(Object.keys(STATUS) as Status[]).map(k => <option key={k} value={k}>{STATUS[k]}</option>)}</select><input type="search" className="admin-search" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="ابحث في العنوان أو النص أو التصنيف" aria-label="بحث في المواد" /></div>
      <button type="button" className="detail-btn" aria-pressed={archived} onClick={() => { setArchived(!archived); setPage(0); setSelectedIds([]); }}>{archived ? "العودة للمواد النشطة" : "عرض الأرشيف"}</button>
      {!archived && <div className="admin-bulk"><button className="detail-btn" disabled={rows.length === 0} onClick={() => setSelectedIds(current => rows.every(row => current.includes(row.id)) ? current.filter(id => !rows.some(row => row.id === id)) : [...new Set([...current, ...rows.map(row => row.id)])])}>تحديد/إلغاء تحديد الصفحة</button><span>المحدد: {selectedIds.length}</span><select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value as Status | "")} aria-label="الحالة الجماعية"><option value="">تغيير حالة المحدد…</option>{(Object.keys(STATUS) as Status[]).filter(key => key !== "published" || user?.role === "owner").map(key => <option key={key} value={key}>{STATUS[key]}</option>)}</select><button className="detail-btn primary-detail" disabled={!selectedIds.length || !selectedStatus || bulk.isPending} onClick={() => selectedStatus && bulk.mutate({ ids: selectedIds, status: selectedStatus })}>تطبيق</button></div>}
      <div className="admin-list">{list.isLoading ? <div className="skeleton" /> :
        list.isError ? <button type="button" className="detail-btn" onClick={() => void list.refetch()}>تعذّر تحميل المواد. أعد المحاولة</button> :
        rows.length === 0 ? <p className="empty-state-light">{search ? "لا توجد نتائج مطابقة." : "لا توجد مواد هنا."}</p> :
        rows.map(material => <div key={material.id} className="admin-row">
          {!archived && <input type="checkbox" checked={selectedIds.includes(material.id)} aria-label={"تحديد " + material.title}
            onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, material.id])] : current.filter(id => id !== material.id))} />}
          <div><b>{material.title}</b><small>{material.category || "بدون تصنيف"}</small></div>
          {!archived && <select className={"st st-" + material.status} value={material.status} aria-label="تغيير الحالة" onChange={event => update.mutate({ id: material.id, data: { status: event.target.value as Status } })}>
            {(Object.keys(STATUS) as Status[]).filter(key => user?.role === "owner" || key !== "published" || material.status === "published").map(key =>
              <option key={key} value={key} disabled={key === "published" && user?.role !== "owner"}>{STATUS[key]}</option>)}
          </select>}
          <button className="icon-btn" aria-label="سجل التعديلات" onClick={() => setHistoryId(material.id)}><History size={17} /></button>
          {!archived && <button className="icon-btn" aria-label="تعديل" onClick={() => void edit(material.id)}><Pencil size={17} /></button>}
          {user?.role === "owner" && <button className="icon-btn" disabled={archive.isPending} aria-label={archived ? "استرجاع المادة" : "أرشفة المادة"} onClick={() => archive.mutate({ id: material.id, archived: !archived })}>
            {archived ? <RotateCcw size={17} /> : <Archive size={17} />}
          </button>}
        </div>)}</div>
      <div className="admin-pagination"><span>{total === 0 ? "0" : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)}`} من {total}</span><div><button className="detail-btn" disabled={page === 0} onClick={() => { setPage(value => Math.max(0, value - 1)); setSelectedIds([]); }}>السابق</button><button className="detail-btn" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => { setPage(value => value + 1); setSelectedIds([]); }}>التالي</button></div></div>
    </div>
    <Dialog open={historyId !== null} onOpenChange={open => { if (!open) setHistoryId(null); }}>
      <DialogContent className="max-h-[82vh] overflow-y-auto" aria-describedby="material-history-description">
        <DialogHeader><DialogTitle>سجل تعديلات المادة</DialogTitle><DialogDescription id="material-history-description">يعرض من عدّل المادة ومتى والحقول التي تغيرت، مع مقارنة النسخة السابقة باللاحقة.</DialogDescription></DialogHeader>
        {history.isLoading ? <p>جارٍ تحميل السجل…</p> : history.data?.length ? <ol className="space-y-4">
          {history.data.map(entry => <li key={entry.id} className="border-b border-border pb-3">
            <div className="flex flex-wrap justify-between gap-2"><b>{entry.action === "create" ? "إنشاء" : entry.action === "import" ? "استيراد" : entry.action === "delete" ? "حذف سابق" : entry.action === "archive" ? "أرشفة" : entry.action === "restore" ? "استرجاع" : entry.action === "status" ? "تغيير الحالة" : "تعديل"} — {entry.actor}</b><time>{new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.at))}</time></div>
            {entry.changes.map(change => <details key={change.field} className="mt-2"><summary>{({ kind: "القسم", title: "العنوان", category: "التصنيف", body: "النص", source: "المصدر", grade: "الدرجة", status: "الحالة" } as Record<string, string>)[change.field] ?? change.field}</summary><div className="grid gap-2 sm:grid-cols-2"><pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">السابق: {String(change.from ?? "—").slice(0, 1200)}</pre><pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">اللاحق: {String(change.to ?? "—").slice(0, 1200)}</pre></div></details>)}
          </li>)}
        </ol> : <p>لا توجد تغييرات مسجلة لهذه المادة.</p>}
      </DialogContent>
    </Dialog>
    <Dialog open={form !== null} onOpenChange={open => { if (!open) setForm(null); }}>
      {form && <DialogContent dir="rtl" className="modal form-modal" aria-describedby={undefined}>
      <DialogTitle>{form.id ? "تعديل مادة" : "مادة جديدة"}</DialogTitle>
      <div className="form-grid">
        <label>القسم<select value={form.kind} onChange={e => set("kind", e.target.value)}>{(Object.keys(KINDS) as Kind[]).map(k => <option key={k} value={k}>{KINDS[k].label}</option>)}</select></label>
        <label>الحالة<select value={form.status} onChange={e => set("status", e.target.value)}>{(["draft", "review"] as Status[]).map(k => <option key={k} value={k}>{STATUS[k]}</option>)}</select></label>
        {form.id && <p className="review-edit-note">تعديل المادة المنشورة يعيدها تلقائيًا إلى المراجعة؛ يعتمد المالك نشر النسخة المحدّثة.</p>}
        <label className="wide">العنوان<input value={form.title} onChange={e => set("title", e.target.value)} /></label>
        <label>التصنيف<input value={form.category} onChange={e => set("category", e.target.value)} placeholder="مثال: أذكار الصباح" /></label>
        <label>{form.kind === "sunnah" ? "التخريج الظاهر للقارئ" : "مرجع المراجعة الداخلي"}<input value={form.source} onChange={e => set("source", e.target.value)} /></label>
        <label className="wide">الدرجة (اختياري)<input value={form.grade} onChange={e => set("grade", e.target.value)} placeholder="صحيح، حسن…" /></label>
        <label className="wide">النص<textarea rows={9} value={form.body} onChange={e => set("body", e.target.value)} /></label>
      </div>
      <div className="modal-foot"><button className="detail-btn" onClick={() => setForm(null)}>إلغاء</button><button className="detail-btn primary-detail" disabled={!form.title.trim() || !form.body.trim() || create.isPending || update.isPending} onClick={save}>حفظ</button></div>
    </DialogContent>}
    </Dialog>
    <Dialog open={importing} onOpenChange={setImporting}>
      <DialogContent dir="rtl" className="modal form-modal">
      <DialogTitle>استيراد جماعي</DialogTitle>
      <DialogDescription className="hint">الصق مصفوفة JSON. كل عنصر: <code>{`{"title":"…","body":"…","category":"…","source":"…"}`}</code>. تُضاف العناصر المستوردة كمسودات؛ أرسلها للمراجعة بعد التحقق من النص.</DialogDescription>
      <textarea className="json-box" rows={10} dir="ltr" value={json} onChange={e => setJson(e.target.value)} aria-label="بيانات المواد بصيغة JSON" />
      <div className="modal-foot"><button className="detail-btn" onClick={() => setImporting(false)}>إلغاء</button><button className="detail-btn primary-detail" disabled={!json.trim() || many.isPending} onClick={doImport}>استيراد</button></div>
    </DialogContent></Dialog>
  </>;
}
