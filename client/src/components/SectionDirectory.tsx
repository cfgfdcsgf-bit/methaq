import { useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowLeft, Search, X } from "lucide-react";
import { directoryHref, featuredDestinations, findDestinations, sections, selectedSection } from "@/lib/sections";

export default function SectionDirectory() {
  const [query, setQuery] = useState("");
  const group = selectedSection(new URLSearchParams(useSearch()).get("section"));
  const searching = query.trim().length > 0;
  const results = searching ? findDestinations(query) : featuredDestinations(group).map(entry => ({ entry, section: group }));
  return <main className="section-wrap directory-page">
    <header className="directory-heading">
      <div><h1>استكشف مِيثَاق</h1><p>ابحث باسم الأداة أو الموضوع.</p></div>
      <div className="directory-search"><Search size={19} aria-hidden="true" /><input aria-label="ابحث عن وجهة" placeholder="الصلاة، السيرة، الدعاء…" value={query} maxLength={100} onChange={e => setQuery(e.target.value)} />{query && <button type="button" aria-label="مسح البحث" onClick={() => setQuery("")}><X size={18} /></button>}</div>
    </header>
    <div className="directory-layout">
      <nav className="directory-nav" aria-label="وجهات مِيثَاق">{sections.map(item => <Link key={item.id} aria-current={!searching && item.id === group.id ? "page" : undefined} href={directoryHref(item.id)} onClick={() => setQuery("")}><item.icon size={20} aria-hidden="true" /><span>{item.label}</span></Link>)}</nav>
      <section className="directory-panel" aria-labelledby="directory-panel-title">
        <header className="directory-panel-heading"><div><h2 id="directory-panel-title">{searching ? "نتائج البحث" : group.title}</h2>{!searching && <p>{group.description}</p>}</div></header>
        {results.length ? <ul className="directory-entries">{results.map(({ entry, section }) => <li key={entry.href}><Link href={entry.href}><span className="directory-entry-icon"><entry.icon size={19} aria-hidden="true" /></span><span><strong>{entry.name}</strong><small>{entry.description}{searching ? " · " + section.label : ""}</small></span><ArrowLeft size={18} aria-hidden="true" /></Link></li>)}</ul> : <p role="status" className="directory-empty">تعذّر العثور على وجهة بهذا الاسم.</p>}
      </section>
    </div>
  </main>;
}
