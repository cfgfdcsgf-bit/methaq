import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Search, X } from "lucide-react";
import { KINDS } from "./ContentPage";

export default function SearchPalette({ open, close }: { open: boolean; close: () => void }) {
  const [q, setQ] = useState(""); const [, go] = useLocation();
  const res = trpc.content.list.useQuery({ q: q.trim(), limit: 12 }, { enabled: open && q.trim().length >= 2 });
  useEffect(() => { if (!open) setQ(""); }, [open]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && close(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [close]);
  if (!open) return null;
  return <div className="modal-back top" onClick={close}><div className="modal palette" role="dialog" aria-modal onClick={e => e.stopPropagation()}>
    <div className="palette-input"><Search size={19} /><input autoFocus placeholder="ابحث في كل مِيثَاق…" value={q} onChange={e => setQ(e.target.value)} /><button className="icon-btn" aria-label="إغلاق" onClick={close}><X size={18} /></button></div>
    <div className="palette-body">{q.trim().length < 2 ? <p className="hint">اكتب حرفين على الأقل للبحث في القرآن والسنة والمكتبة والتعلّم والأذكار.</p> : res.isLoading ? <div className="skeleton" /> : (res.data ?? []).length === 0 ? <p className="hint">لا نتائج. جرّب كلمة أخرى.</p> : (res.data ?? []).map(m => <button key={m.id} className="palette-item" onClick={() => { go(`${KINDS[m.kind].path}?open=${m.id}`); close(); }}><span><b>{m.title}</b><small>{KINDS[m.kind].label}{m.category ? ` · ${m.category}` : ""}</small></span><ArrowLeft size={15} /></button>)}</div>
  </div></div>;
}
