import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Search, X } from "lucide-react";
import { findDestinations } from "@/lib/sections";
import { KINDS } from "./ContentPage";

export default function SearchPalette({ open, close }: { open: boolean; close: () => void }) {
  const [q, setQ] = useState(""); const [, go] = useLocation();
  const res = trpc.content.list.useQuery({ q: q.trim(), limit: 12 }, { enabled: open && q.trim().length >= 2 });
  useEffect(() => { if (!open) setQ(""); }, [open]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && close(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [close]);
  if (!open) return null;
  const query = q.trim();
  const destinations = query.length >= 2 ? findDestinations(query).slice(0, 5) : [];
  const materials = res.data ?? [];
  const navigate = (href: string) => { go(href); close(); };
  return <div className="modal-back top" onClick={close}><div className="modal palette" role="dialog" aria-label="البحث في مِيثَاق" aria-modal onClick={e => e.stopPropagation()}>
    <div className="palette-input"><Search size={19} /><input autoFocus aria-label="ابحث في مِيثَاق" placeholder="ابحث في مِيثَاق…" maxLength={100} value={q} onChange={e => setQ(e.target.value)} /><button className="icon-btn" aria-label="إغلاق" onClick={close}><X size={18} /></button></div>
    <div className="palette-body">
      {query.length < 2 ? <p className="hint">اكتب حرفين على الأقل للبحث عن وجهة أو مادة.</p> : <>
        {destinations.length > 0 && <section className="palette-destinations" aria-label="وجهات مقترحة"><h2>الوجهات</h2>{destinations.map(({ entry, section }) => <button key={entry.href} className="palette-item" onClick={() => navigate(entry.href)}><entry.icon size={17} aria-hidden="true" /><span><b>{entry.name}</b><small>{section.label}</small></span><ArrowLeft size={15} /></button>)}</section>}
        {materials.length > 0 && <section className="palette-destinations" aria-label="المواد المنشورة"><h2>المواد</h2>{materials.map(item => <button key={item.id} className="palette-item" onClick={() => navigate(`${KINDS[item.kind].path}?open=${item.id}`)}><span><b>{item.title}</b><small>{KINDS[item.kind].label}{item.category ? ` · ${item.category}` : ""}</small></span><ArrowLeft size={15} /></button>)}</section>}
        {res.isLoading && <p className="hint" role="status">جارٍ البحث في المواد…</p>}
        {res.isError && <p className="hint" role="status">تعذّر الاتصال بالمواد المنشورة.</p>}
        {!destinations.length && !materials.length && !res.isLoading && !res.isError && <p className="hint" role="status">لا نتائج. جرّب كلمة أخرى.</p>}
      </>}
    </div>
  </div></div>;
}
