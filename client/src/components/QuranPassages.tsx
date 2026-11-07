import { useEffect, useState } from "react";

export type QuranPassageReference = { title: string; surah: number; ayah: number };

type Passage = { surahName: string; text: string };

const QURAN_DATA_URL = "/data/quran/quran-hafs.tsv";

export default function QuranPassages({ references, compact = false }: { references: QuranPassageReference[]; compact?: boolean }) {
  const [passages, setPassages] = useState<Map<string, Passage>>(new Map());
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const referencesJson = JSON.stringify(references);

  useEffect(() => {
    let cancelled = false;
    const currentReferences = JSON.parse(referencesJson) as QuranPassageReference[];
    fetch(QURAN_DATA_URL, { cache: "force-cache" })
      .then(response => {
        if (!response.ok) throw new Error("Quran data unavailable");
        return response.text();
      })
      .then(source => {
        const wanted = new Set(currentReferences.map(reference => `${reference.surah}:${reference.ayah}`));
        const found = new Map<string, Passage>();
        for (const line of source.split(/\r?\n/)) {
          if (!line || line.startsWith("id\t")) continue;
          const columns = line.split("\t");
          if (columns.length < 10) continue;
          const key = `${columns[3]}:${columns[8]}`;
          if (wanted.has(key) && columns[5] && columns[9]) found.set(key, { surahName: columns[5], text: columns[9] });
        }
        if (found.size !== wanted.size) throw new Error("A requested Quran passage is missing from the bundled text");
        if (!cancelled) {
          setPassages(found);
          setState("ready");
        }
      })
      .catch(error => {
        console.error("Unable to load a local Quran passage:", error);
        if (!cancelled) setState("error");
      });
    return () => { cancelled = true; };
  }, [referencesJson]);

  if (state === "loading") return <p className="local-passage-status" role="status">جارٍ تجهيز الآيات…</p>;
  if (state === "error") return <p className="local-passage-status is-error" role="alert">تعذّر تحميل الآيات من ملفات الموقع.</p>;

  return <div className={`local-passage-grid${compact ? " is-compact" : ""}`}>
    {references.map(reference => {
      const passage = passages.get(`${reference.surah}:${reference.ayah}`)!;
      return <article className="local-passage-card" key={`${reference.surah}:${reference.ayah}`}>
        <span className="local-passage-label">{reference.title}</span>
        <blockquote lang="ar" dir="rtl">{passage.text}</blockquote>
        <a href={`/quran?surah=${reference.surah}&ayah=${reference.ayah}`}>سورة {passage.surahName} · الآية {reference.ayah.toLocaleString("ar-EG")}</a>
      </article>;
    })}
  </div>;
}
