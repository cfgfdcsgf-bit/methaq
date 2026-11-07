import { Fragment, useEffect, useMemo, useState } from "react";
import { Bookmark, BookOpen, ChevronLeft, ChevronRight, Headphones, Minus, Plus, Search } from "lucide-react";
import { useSearch } from "wouter";

type Surah = { number: number; name: string; ayahCount: number };
type Ayah = { surah: number; number: number; text: string; page: number; juz: number; globalNumber: number };
type ReaderAudio = { kind: "surah"; surah: number } | { kind: "ayah"; globalNumber: number };
type TafsirState = { key: string; status: "loading" | "ready" | "error"; text?: string };

const QURAN_DATA_URL = "/data/quran/quran-hafs.tsv";
const TOTAL_PAGES = 604;
const RECITERS = [
  { id: "ar.alafasy", name: "مشاري العفاسي", bitrate: 128 },
  { id: "ar.husary", name: "محمود خليل الحصري", bitrate: 128 },
  { id: "ar.minshawi", name: "محمد صديق المنشاوي", bitrate: 128 },
  { id: "ar.sudais", name: "عبدالرحمن السديس", bitrate: 192 },
  { id: "ar.shuraim", name: "سعود الشريم", bitrate: 128 },
  { id: "ar.abdulbasit", name: "عبد الباسط عبد الصمد", bitrate: 192 },
] as const;

function removeDiacritics(text: string) {
  return text.normalize("NFD").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").toLowerCase();
}

function ayahId(surah: number, number: number) {
  return "quran-ayah-" + surah + "-" + number;
}

function storedPage() {
  const routePage = Number(new URLSearchParams(window.location.search).get("page"));
  if (Number.isInteger(routePage) && routePage > 0 && routePage <= TOTAL_PAGES) return routePage;
  try {
    const savedPage = Number(localStorage.getItem("quranPage"));
    if (Number.isInteger(savedPage) && savedPage > 0 && savedPage <= TOTAL_PAGES) return savedPage;
  } catch { /* local storage is optional */ }
  return 1;
}

function parseQuranData(source: string) {
  const surahMap = new Map<number, Surah>();
  const verses: Ayah[] = [];
  for (const line of source.split(/\r?\n/)) {
    if (!line || line.startsWith("id\t")) continue;
    const columns = line.split("\t");
    if (columns.length < 11) continue;
    const globalNumber = Number(columns[0]);
    const juz = Number(columns[1]);
    const page = Number(columns[2]);
    const surah = Number(columns[3]);
    const number = Number(columns[8]);
    const name = columns[5];
    const text = columns[9].replace(/^\uFEFF/, "").trim();
    if (!Number.isInteger(globalNumber) || !Number.isInteger(page) || !Number.isInteger(surah) || !Number.isInteger(number) || !name || !text) continue;
    const existing = surahMap.get(surah);
    surahMap.set(surah, { number: surah, name, ayahCount: (existing?.ayahCount ?? 0) + 1 });
    verses.push({ surah, number, text, page, juz, globalNumber });
  }
  return { surahs: [...surahMap.values()], verses };
}

function displayAyahText(text: string) {
  // The local Uthmanic file ends each ayah with a private-use ornamental stop.
  // The reader renders its own accessible ayah number medallion in its place.
  return text.replace(/[\uE000-\uF8FF]+$/u, "").trim();
}

export default function QuranReader() {
  const search = useSearch();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [ayat, setAyat] = useState<Ayah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState(1);
  const [selectedPage, setSelectedPage] = useState(storedPage);
  const [query, setQuery] = useState("");
  const [fontSize, setFontSize] = useState(() => {
    try { return Math.min(52, Math.max(28, Number(localStorage.getItem("quranFontSize")) || 38)); }
    catch { return 38; }
  });
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [activeAyah, setActiveAyah] = useState<Ayah | null>(null);
  const [studyOpen, setStudyOpen] = useState(false);
  const [tafsir, setTafsir] = useState<TafsirState | null>(null);
  const [reciter, setReciter] = useState<string>(RECITERS[0].id);
  const [audioTarget, setAudioTarget] = useState<ReaderAudio | null>(null);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(QURAN_DATA_URL, { cache: "force-cache" }).then(response => {
      if (!response.ok) throw new Error("Quran data unavailable");
      return response.text();
    }).then(text => {
      const { surahs: surahData, verses } = parseQuranData(text);
      if (surahData.length !== 114 || verses.length !== 6236 || new Set(verses.map(verse => verse.page)).size !== TOTAL_PAGES) throw new Error("Quran dataset integrity check failed");
      const counts = new Map<number, number>();
      verses.forEach((verse, index) => {
        const expected = (counts.get(verse.surah) ?? 0) + 1;
        if (verse.number !== expected || verse.globalNumber !== index + 1) throw new Error("Quran numbering is not sequential");
        counts.set(verse.surah, expected);
      });
      if (surahData.some(surah => counts.get(surah.number) !== surah.ayahCount)) throw new Error("Quran ayah counts do not match the local file");
      if (cancelled) return;
      setSurahs(surahData);
      setAyat(verses);
      setLoadState("ready");
    }).catch(error => {
      console.error("Unable to load the local Quran text:", error);
      if (!cancelled) setLoadState("error");
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ayat.length) return;
    const params = new URLSearchParams(search);
    const pageParam = Number(params.get("page"));
    const requestedSurah = Number(params.get("surah"));
    const requestedAyah = Number(params.get("ayah"));
    if (Number.isInteger(pageParam) && pageParam > 0 && pageParam <= TOTAL_PAGES) {
      const first = ayat.find(verse => verse.page === pageParam);
      setSelectedPage(pageParam);
      if (first) setSelectedSurah(first.surah);
    } else if (Number.isInteger(requestedSurah) && requestedSurah > 0 && requestedSurah <= 114) {
      const destination = ayat.find(verse => verse.surah === requestedSurah && verse.number === requestedAyah)
        ?? ayat.find(verse => verse.surah === requestedSurah);
      if (destination) {
        setSelectedPage(destination.page);
        setSelectedSurah(destination.surah);
        setActiveAyah(destination);
      }
    } else {
      const savedPageStart = ayat.find(verse => verse.page === selectedPage);
      if (savedPageStart) setSelectedSurah(savedPageStart.surah);
    }
  }, [search, ayat]);

  const activeSurah = surahs.find(surah => surah.number === selectedSurah);
  const normalizedQuery = removeDiacritics(query.trim());
  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return ayat.filter(verse => removeDiacritics(verse.text).includes(normalizedQuery)).slice(0, 80);
  }, [ayat, normalizedQuery]);
  const pageAyat = useMemo(() => ayat.filter(verse => verse.page === selectedPage), [ayat, selectedPage]);
  const basmala = useMemo(() => {
    const opening = ayat.find(verse => verse.surah === 1 && verse.number === 1);
    return opening ? displayAyahText(opening.text) : "";
  }, [ayat]);
  const selectedReciter = RECITERS.find(item => item.id === reciter) ?? RECITERS[0];
  const audioSource = !audioTarget ? "" : audioTarget.kind === "surah"
    ? "https://cdn.islamic.network/quran/audio-surah/" + selectedReciter.bitrate + "/" + selectedReciter.id + "/" + audioTarget.surah + ".mp3"
    : "https://cdn.islamic.network/quran/audio/" + selectedReciter.bitrate + "/" + selectedReciter.id + "/" + audioTarget.globalNumber + ".mp3";
  const audioTitle = audioTarget?.kind === "surah"
    ? "تلاوة سورة " + (surahs.find(surah => surah.number === audioTarget.surah)?.name ?? "")
    : "تلاوة الآية المختارة";

  function savePage(page: number) {
    const nextPage = Math.min(TOTAL_PAGES, Math.max(1, page));
    setSelectedPage(nextPage);
    try { localStorage.setItem("quranPage", String(nextPage)); } catch { /* local storage is optional */ }
    const first = ayat.find(verse => verse.page === nextPage);
    if (first) setSelectedSurah(first.surah);
  }

  function selectSurah(number: number) {
    const first = ayat.find(verse => verse.surah === number);
    if (!first) return;
    setSelectedSurah(number);
    setSelectedPage(first.page);
    setQuery("");
    try { localStorage.setItem("quranPage", String(first.page)); } catch { /* local storage is optional */ }
  }

  function changeFont(delta: number) {
    const next = Math.min(52, Math.max(28, fontSize + delta));
    setFontSize(next);
    try { localStorage.setItem("quranFontSize", String(next)); } catch { /* local storage is optional */ }
  }

  function openAyah(verse: Ayah) {
    setSelectedSurah(verse.surah);
    setSelectedPage(verse.page);
    setActiveAyah(verse);
    setStudyOpen(true);
    setTafsir(null);
    setAudioError(false);
    setQuery("");
  }

  function savePosition() {
    const verse = activeAyah ?? pageAyat[0];
    if (!verse) return;
    const name = surahs.find(surah => surah.number === verse.surah)?.name ?? "";
    try {
      localStorage.setItem("lastRead", JSON.stringify({ kind: "quran", surah: verse.surah, ayah: verse.number, page: verse.page, title: "سورة " + name + " · الآية " + verse.number.toLocaleString("ar-EG") }));
      localStorage.setItem("quranPage", String(verse.page));
    } catch { /* local storage is optional */ }
  }

  async function loadTafsir(verse: Ayah) {
    const key = verse.surah + ":" + verse.number;
    setActiveAyah(verse);
    setStudyOpen(true);
    setTafsir({ key, status: "loading" });
    try {
      const response = await fetch("https://api.alquran.cloud/v1/ayah/" + verse.surah + ":" + verse.number + "/ar.muyassar", { cache: "force-cache" });
      if (!response.ok) throw new Error("Tafsir unavailable");
      const result = await response.json() as { code?: number; data?: { text?: string } };
      if (result.code !== 200 || !result.data?.text) throw new Error("Tafsir unavailable");
      setTafsir({ key, status: "ready", text: result.data.text });
    } catch {
      setTafsir({ key, status: "error" });
    }
  }

  function setAudio(target: ReaderAudio) {
    setAudioError(false);
    setAudioTarget(target);
  }

  return <section className="quran-reader-panel" id="quran-reader" aria-labelledby="quran-reader-title" translate="no">
    <header className="quran-reader-heading">
      <div>
        <span className="kicker">صفحاتٌ من المصحف الشريف</span>
        <h2 id="quran-reader-title">اقرأ بتأنٍ، آيةً آية</h2>
        <p>المصحف كاملًا بصفحاته، وخطٌّ تكبّره كما يريح عينيك. اختر آيةً للتفسير أو الاستماع.</p>
      </div>
      <div className="quran-reader-actions" aria-label="أدوات القراءة">
        <button type="button" onClick={() => changeFont(-2)} aria-label="تصغير خط القرآن">A−</button>
        <span aria-live="polite">{fontSize}</span>
        <button type="button" onClick={() => changeFont(2)} aria-label="تكبير خط القرآن">A+</button>
        <button type="button" onClick={savePosition} aria-label="حفظ موضع القراءة" title="حفظ موضع القراءة"><Bookmark size={18} /></button>
      </div>
    </header>

    <div className="quran-reader-controls">
      <label className="quran-surah-picker">السورة
        <select value={selectedSurah} onChange={event => selectSurah(Number(event.target.value))} disabled={loadState !== "ready"}>
          {surahs.map(surah => <option key={surah.number} value={surah.number}>{surah.number.toLocaleString("ar-EG")} · {surah.name}</option>)}
        </select>
      </label>
      <label className="quran-page-picker">صفحة المصحف
        <select value={selectedPage} onChange={event => savePage(Number(event.target.value))} disabled={loadState !== "ready"}>
          {Array.from({ length: TOTAL_PAGES }, (_, index) => index + 1).map(page => <option key={page} value={page}>صفحة {page.toLocaleString("ar-EG")}</option>)}
        </select>
      </label>
      <label className="quran-search"><Search size={19} /><span className="sr-only">ابحث في آيات القرآن</span>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث في آيات المصحف…" disabled={loadState !== "ready"} />
      </label>
    </div>

    <div className="quran-listen-bar">
      <label><Headphones size={18} /> القارئ
        <select value={reciter} onChange={event => setReciter(event.target.value)}>
          {RECITERS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => setAudio({ kind: "surah", surah: selectedSurah })} disabled={loadState !== "ready" || !activeSurah}>
        <BookOpen size={17} /> استمع إلى السورة
      </button>
    </div>

    {loadState === "loading" && <div className="quran-reader-message" role="status">جارٍ تجهيز صفحات المصحف…</div>}
    {loadState === "error" && <div className="quran-reader-message is-error" role="alert">تعذّر تحميل نص المصحف المحلي أو اجتياز فحص سلامته؛ لم نعرض نصًا بديلًا.</div>}
    {loadState === "ready" && (normalizedQuery ? <>
      <div className="quran-search-summary" role="status">{searchResults.length ? "نتائج البحث: " + searchResults.length.toLocaleString("ar-EG") + (searchResults.length === 80 ? " (أول ٨٠ نتيجة)" : "") : "لا توجد آيات مطابقة."}</div>
      <div className="mushaf-search-results">
        {searchResults.map(verse => <button type="button" key={verse.globalNumber} onClick={() => openAyah(verse)}>
          <span>{verse.text.replace(/[\uE000-\uF8FF]+$/u, "").trim()}</span>
          <small>سورة {surahs.find(surah => surah.number === verse.surah)?.name} · الآية {verse.number.toLocaleString("ar-EG")} · الصفحة {verse.page.toLocaleString("ar-EG")}</small>
        </button>)}
      </div>
    </> : <>
      <div className="mushaf-page-frame">
        <article className="mushaf-page-surface" aria-label={"صفحة المصحف " + selectedPage.toLocaleString("ar-EG")}>
          <div className="mushaf-page-top"><span>الجزء {pageAyat[0]?.juz.toLocaleString("ar-EG") ?? "١"}</span><span className="mushaf-page-rosette" aria-hidden="true">✦</span><span>صفحة {selectedPage.toLocaleString("ar-EG")}</span></div>
          <div className="mushaf-page-text" style={{ "--quran-font-size": fontSize + "px" } as React.CSSProperties}>
            {pageAyat.map(verse => {
              const surahName = surahs.find(surah => surah.number === verse.surah)?.name ?? "";
              const beginsSurah = verse.number === 1;
              const selected = activeAyah?.surah === verse.surah && activeAyah.number === verse.number;
              return <Fragment key={verse.globalNumber}>
                {beginsSurah && <div className="mushaf-surah-heading"><span aria-hidden="true">✦</span><b>سورة {surahName}</b><span aria-hidden="true">✦</span></div>}
                {beginsSurah && verse.surah !== 1 && verse.surah !== 9 && <div className="mushaf-basmala" lang="ar">{basmala}</div>}
                <button type="button" id={ayahId(verse.surah, verse.number)} className={"mushaf-ayah" + (selected ? " is-selected" : "")} onClick={() => openAyah(verse)} aria-pressed={Boolean(selected)} aria-label={"اختيار الآية " + verse.number.toLocaleString("ar-EG") + " من سورة " + surahName}>
                  <span className="mushaf-ayah-text" lang="ar">{displayAyahText(verse.text)}</span><span className="mushaf-ayah-end" aria-hidden="true">{verse.number.toLocaleString("ar-EG")}</span>
                </button>
              </Fragment>;
            })}
          </div>
          <div className="mushaf-page-bottom"><span aria-hidden="true">✦</span><b>{selectedPage.toLocaleString("ar-EG")}</b><span aria-hidden="true">✦</span></div>
        </article>
      </div>

      <nav className="mushaf-page-nav" aria-label="التنقل بين صفحات المصحف">
        <button type="button" onClick={() => savePage(selectedPage - 1)} disabled={selectedPage <= 1}><ChevronRight size={19} /> الصفحة السابقة</button>
        <span>صفحة {selectedPage.toLocaleString("ar-EG")} من {TOTAL_PAGES.toLocaleString("ar-EG")}</span>
        <button type="button" onClick={() => savePage(selectedPage + 1)} disabled={selectedPage >= TOTAL_PAGES}>الصفحة التالية <ChevronLeft size={19} /></button>
      </nav>

      {studyOpen && <section className="quran-verse-study" aria-live="polite">
        <div className="quran-study-heading"><div><span className="kicker">تدبّرٌ وتعلّم</span><h3>{activeAyah ? "الآية المختارة" : "اختر آية"}</h3><small>{activeAyah ? "سورة " + (surahs.find(surah => surah.number === activeAyah.surah)?.name ?? "") + " · الآية " + activeAyah.number.toLocaleString("ar-EG") : "انقر على آية في الصفحة"}</small></div>
          {activeAyah && <div className="quran-study-actions"><button type="button" onClick={() => loadTafsir(activeAyah)}><BookOpen size={16} /> تفسير الآية</button><button type="button" onClick={() => setAudio({ kind: "ayah", globalNumber: activeAyah.globalNumber })}><Headphones size={16} /> استمع للآية</button></div>}
        </div>
        {activeAyah && <blockquote className="quran-study-ayah" lang="ar">{displayAyahText(activeAyah.text)}</blockquote>}
        {tafsir?.key === (activeAyah ? activeAyah.surah + ":" + activeAyah.number : "") && <div className="quran-tafsir">
          <h4>التفسير الميسّر</h4>
          {tafsir.status === "loading" && <p role="status">جارٍ تحميل التفسير…</p>}
          {tafsir.status === "error" && <p role="alert">تعذّر تحميل التفسير الآن. تحقق من الاتصال ثم أعد المحاولة.</p>}
          {tafsir.status === "ready" && <p>{tafsir.text}</p>}
        </div>}
      </section>}
    </>)}

    {audioSource && <div className="quran-audio-player">
      <div><span className="kicker">تلاوةٌ خاشعة</span><b>{audioTitle}</b><small>القارئ: {selectedReciter.name}</small></div>
      <audio key={audioSource} controls preload="none" src={audioSource} onError={() => setAudioError(true)} aria-label={audioTitle} />
      {audioError && <p role="alert">تعذّر تشغيل الصوت الآن. جرّب اختيار قارئ آخر أو أعد المحاولة لاحقًا.</p>}
    </div>}
  </section>;
}
