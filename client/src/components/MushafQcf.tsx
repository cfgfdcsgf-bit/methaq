import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import "../mushaf-qcf.css";

type QcfWord = {
  code: number;
  font: string;
  type: "word" | "end" | "surah_header" | "bismillah" | "quarter" | string;
  text?: string;
  verse_key?: string;
  position?: number;
  sura?: number;
};
type QcfLine = { line: number; words: QcfWord[] };
type QcfPage = { page: number; font: string; lines: QcfLine[] };
type AyahReference = { surah: number; number: number; page: number; text: string };
type Props = {
  page: number;
  zoom: number;
  retry: number;
  activeKey: string | null;
  playingKey: string | null;
  expectedAyat: AyahReference[];
  surahNames: Record<number, string>;
  onSelect: (surah: number, ayah: number) => void;
  onRetry: () => void;
};

// Prefer the pinned CDN release for page data, then fall back to its GitHub mirror.
// Quran text is checked against the project's local Hafs dataset before display.
const QCF_PACKAGE_BASE = "https://cdn.jsdelivr.net/npm/quran-qcf4@1.1.0";
const QCF_GITHUB_BASE = "https://raw.githubusercontent.com/MohamadHajjRabee/quran-qcf4/main";
const pageCache = new Map<string, Promise<QcfPage>>();
const fontCache = new Map<string, Promise<void>>();
const ayahIndexes = new WeakMap<AyahReference[], Map<string, AyahReference>>();

function getAyahIndex(ayat: AyahReference[]) {
  let index = ayahIndexes.get(ayat);
  if (!index) {
    index = new Map(ayat.map(ayah => [`${ayah.surah}:${ayah.number}`, ayah]));
    ayahIndexes.set(ayat, index);
  }
  return index;
}

function getPage(page: number, sourceIndex = 0) {
  const cacheKey = `${page}:${sourceIndex}`;
  let pending = pageCache.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      const number = String(page).padStart(3, "0");
      let lastError: unknown;
      const urls = [
        `${QCF_PACKAGE_BASE}/pages/${number}.json`,
        `${QCF_GITHUB_BASE}/pages/${number}.json`,
      ].slice(sourceIndex);
      for (const url of urls) {
        try {
          const response = await fetch(url, { cache: "force-cache", signal: AbortSignal.timeout(8000) });
          if (!response.ok) throw new Error(`Mushaf page request failed: ${response.status}`);
          const data = await response.json() as QcfPage;
          if (data.page !== page || !Array.isArray(data.lines) || !data.lines.length) throw new Error("Invalid QCF page data");
          const lineNumbers = new Set<number>();
          for (const line of data.lines) {
            if (!Number.isInteger(line.line) || line.line < 1 || line.line > 15 || lineNumbers.has(line.line)
              || !Array.isArray(line.words) || !line.words.length
              || line.words.some(word => !Number.isInteger(word.code) || word.code < 0 || word.code > 0x10ffff || !/^QCF4_(?:Hafs_\d{2}|QBSML)$/.test(word.font))) {
              throw new Error("Invalid QCF page glyph data");
            }
            lineNumbers.add(line.line);
          }
          return data;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError ?? new Error("Mushaf page request failed");
    })();
    pageCache.set(cacheKey, pending);
    pending.catch(() => pageCache.delete(cacheKey));
  }
  return pending;
}

function getFont(name: string) {
  let pending = fontCache.get(name);
  if (!pending) {
    const file = name === "QCF4_QBSML" ? `${name}.woff2` : `${name}_W.woff2`;
    pending = (async () => {
      let lastError: unknown;
      const urls = [`${QCF_PACKAGE_BASE}/fonts-woff2/${file}`, `https://cdn.jsdelivr.net/gh/MohamadHajjRabee/quran-qcf4@main/fonts-woff2/${file}`, `${QCF_GITHUB_BASE}/fonts-woff2/${file}`];
      for (const url of urls) {
        try {
          const face = await new FontFace(name, `url("${url}") format("woff2")`, { display: "block" }).load();
          document.fonts.add(face);
          return;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError ?? new Error("QCF font request failed");
    })();
    fontCache.set(name, pending);
    pending.catch(() => fontCache.delete(name));
  }
  return pending;
}

function normalizeQuranWordVariants(text: string) {
  const normalized = text.normalize("NFD")
    .replace(/[\u200C-\u200F\u2060]/g, "")
    // U+0670 is an orthographic small alif: some verified Hafs sources write
    // it as a dagger mark, while others encode it as a regular alif or omit it.
    .replace(/\u0670/g, "\uE000")
    // U+06E7 is the Quranic small-high yeh used where another source writes a
    // full yeh. Preserve its letter value for the integrity comparison.
    .replace(/\u06E7/g, "ي")
    // QCF encodes some standalone hamzas with a yeh seat; the local Hafs text
    // encodes the same mark above a tatweel. Canonicalize both before dropping
    // combining marks so words such as أَنبِئُونِي continue to verify.
    .replace(/[\u064B-\u0653\u0655-\u065F\u06D6-\u06ED\uFEFF]/g, "")
    .replace(/[ىي]\u0654/g, "ء")
    .replace(/\u0640\u0654/g, "ء")
    .replace(/و\u0654/g, "ء")
    .replace(/[\u064B-\u065F\u06D6-\u06ED\u0640\uFEFF]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[^\u0621-\u064A\uE000]/g, "");
  let variants = [""];
  for (const character of normalized) {
    variants = character === "\uE000"
      ? variants.flatMap(value => [value, value + "ا"])
      : variants.map(value => value + character);
  }
  return new Set(variants.flatMap(value => [value, value.replace(/ءا/g, "ا")]).map(value => value
    .replace(/الءان/g, "الان")
    // Common Uthmani/Imla'i spellings used differently by trusted Hafs texts.
    .replace(/الصلو(?:ا)?ة/g, "الصلاة")
    .replace(/الزكو(?:ا)?ة/g, "الزكاة")
    .replace(/الحيو(?:ا)?ة/g, "الحياة")
    .replace(/الربو(?:ا)?/g, "الربا")));
}

function normalizeQuranTokens(text: string) {
  return text.normalize("NFD")
    .replace(/[\u200C-\u200F\u2060]/g, "")
    .replace(/\u0670/g, "\uE000")
    .replace(/\u06E7/g, "ي")
    .replace(/[\u064B-\u0653\u0655-\u065F\u06D6-\u06ED\uFEFF]/g, "")
    .replace(/[ىي]\u0654/g, "ء")
    .replace(/\u0640\u0654/g, "ء")
    .replace(/و\u0654/g, "ء")
    .replace(/[\u064B-\u065F\u06D6-\u06ED\u0640\uFEFF]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[^\u0621-\u064A\uE000\s]/g, "")
    .trim().split(/\s+/).filter(Boolean);
}

function makeWordForms(words: string[], maxGroup = 4) {
  return words.map((_, start) => {
    const groups = new Map<number, Set<string>>();
    let forms = new Set([""]);
    for (let length = 1; length <= maxGroup && start + length <= words.length; length += 1) {
      const wordForms = normalizeQuranWordVariants(words[start + length - 1]);
      const combined = new Set<string>();
      for (const prefix of forms) for (const suffix of wordForms) combined.add(prefix + suffix);
      forms = combined;
      groups.set(length, forms);
    }
    return groups;
  });
}

function formsIntersect(left: Set<string>, right: Set<string>) {
  const smaller = left.size < right.size ? left : right;
  const larger = smaller === left ? right : left;
  for (const value of smaller) if (larger.has(value)) return true;
  return false;
}

function matchesQuranWordSequence(printed: string[], expected: string[], complete: boolean) {
  const maxGroup = 4;
  const printedForms = makeWordForms(printed, maxGroup);
  const expectedForms = makeWordForms(expected, maxGroup);
  const reachable = Array.from({ length: printed.length + 1 }, () => Array(expected.length + 1).fill(false));
  if (complete) reachable[0][0] = true;
  else reachable[0].fill(true); // A page can begin or end in the middle of an ayah.

  for (let printedIndex = 0; printedIndex < printed.length; printedIndex += 1) {
    for (let expectedIndex = 0; expectedIndex < expected.length; expectedIndex += 1) {
      if (!reachable[printedIndex][expectedIndex]) continue;
      for (const [printedLength, printedVariants] of printedForms[printedIndex]) {
        for (const [expectedLength, expectedVariants] of expectedForms[expectedIndex]) {
          if (formsIntersect(printedVariants, expectedVariants)) {
            reachable[printedIndex + printedLength][expectedIndex + expectedLength] = true;
          }
        }
      }
    }
  }
  return complete
    ? reachable[printed.length][expected.length]
    : reachable[printed.length].some(Boolean);
}

function verifyPageText(data: QcfPage, expectedAyat: AyahReference[]) {
  const expected = new Map<string, string[]>();
  const expectedByKey = getAyahIndex(expectedAyat);
  const expectedWordsFor = (key: string) => {
    const cached = expected.get(key);
    if (cached) return cached;
    const ayah = expectedByKey.get(key);
    if (!ayah) return undefined;
    const words = normalizeQuranTokens(ayah.text);
    expected.set(key, words);
    return words;
  };
  const wordsByAyah = new Map<string, Array<{ position: number; text: string }>>();
  const completedAyat = new Set<string>();
  let validatedWords = 0;
  for (const line of data.lines) {
    for (const word of line.words) {
      if (word.type === "bismillah") {
        const printedBasmala = normalizeQuranTokens(word.text ?? "");
        const localBasmala = expectedWordsFor("1:1") ?? [];
        if (!matchesQuranWordSequence(printedBasmala, localBasmala, true)) throw new Error("Quran bismillah integrity check failed");
        continue;
      }
      if (!word.verse_key) continue;
      const expectedWords = expectedWordsFor(word.verse_key);
      if (!expectedWords) throw new Error(`QCF page references unexpected verse ${word.verse_key}`);
      if (word.type === "end") { completedAyat.add(word.verse_key); continue; }
      if (word.type !== "word") continue;
      if (!word.text || !Number.isInteger(word.position) || !word.position || word.position < 1) throw new Error("QCF page word is missing its verse position");
      // The QCF font map uses a private placeholder for the prostration sign
      // ۩ on the sajdah verses. It is a printed mark, not a Quran word.
      if (word.text === "#1969" && word.position === expectedWords.length + 1 && expectedByKey.get(word.verse_key)?.text.includes("\u06E9")) continue;
      const printedTokens = normalizeQuranTokens(word.text);
      if (printedTokens.length !== 1) throw new Error(`Quran word integrity check failed for ${word.verse_key}`);
      wordsByAyah.set(word.verse_key, [...(wordsByAyah.get(word.verse_key) ?? []), { position: word.position, text: printedTokens[0] }]);
      validatedWords += 1;
    }
  }

  for (const [key, words] of wordsByAyah) {
    const positions = words.map(word => word.position);
    if (positions.some((position, index) => index > 0 && position !== positions[index - 1] + 1)) {
      throw new Error(`Quran verse structure check failed for ${key}`);
    }
    if (!matchesQuranWordSequence(words.map(word => word.text), expected.get(key) ?? [], completedAyat.has(key))) {
      throw new Error(`Quran word integrity check failed for ${key}`);
    }
  }
  if (validatedWords < 8) throw new Error("QCF page has too little verified Quran text");
}

function isIntegrityFailure(error: unknown) {
  const detail = error instanceof Error ? error.message : "";
  return /QCF page|Quran word integrity|Quran bismillah integrity|Quran verse structure/.test(detail);
}

function getPageErrorMessage(page: number, error: unknown) {
  const pageLabel = page.toLocaleString("ar-EG");
  const detail = error instanceof Error ? error.message : "";
  if (!isIntegrityFailure(error)) return `تعذّر تحميل صفحة ${pageLabel} أو خطها. تحقق من الاتصال ثم أعد المحاولة.`;
  const verseKey = detail.match(/(\d+):(\d+)/);
  if (detail.includes("word integrity") && verseKey) {
    return `توقّف عرض صفحة ${pageLabel}: تعذّرت مطابقة بيانات الآية ${Number(verseKey[2]).toLocaleString("ar-EG")} من سورة ${Number(verseKey[1]).toLocaleString("ar-EG")}.`;
  }
  if (detail.includes("verse structure") && verseKey) {
    return `توقّف عرض صفحة ${pageLabel}: ترتيب كلمات الآية ${Number(verseKey[2]).toLocaleString("ar-EG")} من سورة ${Number(verseKey[1]).toLocaleString("ar-EG")} غير مطابق.`;
  }
  if (detail.includes("unexpected verse") && verseKey) {
    return `توقّف عرض صفحة ${pageLabel}: ظهر مرجع غير متوقع للآية ${Number(verseKey[2]).toLocaleString("ar-EG")} من سورة ${Number(verseKey[1]).toLocaleString("ar-EG")}.`;
  }
  return `تعذّر التحقق من نص صفحة ${pageLabel}، لذلك لم نعرضها.`;
}

async function getVerifiedPage(page: number, expectedAyat: AyahReference[]) {
  let lastError: unknown;
  for (const sourceIndex of [0, 1]) {
    try {
      const data = await getPage(page, sourceIndex);
      verifyPageText(data, expectedAyat);
      return data;
    } catch (error) {
      lastError = error;
      // A valid-looking page from one source may still fail the text check.
      // Try the independent source, but never render unless it verifies too.
      if (!isIntegrityFailure(error) || sourceIndex === 1) throw error;
    }
  }
  throw lastError ?? new Error("QCF page could not be verified");
}

export function prefetchQcfPage(page: number, expectedAyat: AyahReference[]) {
  if (!Number.isInteger(page) || page < 1 || page > 604) return;
  void getVerifiedPage(page, expectedAyat)
    .then(data => Promise.all([...new Set(data.lines.flatMap(line => line.words.map(word => word.font)))].map(getFont)))
    .catch(() => { /* A prefetch must never interrupt the page currently being read. */ });
}

function fitPage(el: HTMLDivElement) {
  const textLines = Array.from(el.querySelectorAll<HTMLElement>(".qcf-line.is-text .qcf-line-inner"));
  if (!textLines.length || !el.clientWidth) return;
  el.classList.add("is-measuring");
  const pageStyle = window.getComputedStyle(el);
  const width = el.clientWidth - Number.parseFloat(pageStyle.paddingInlineStart) - Number.parseFloat(pageStyle.paddingInlineEnd);
  if (!Number.isFinite(width) || width <= 0) { el.classList.remove("is-measuring"); return; }
  const widthAt = (fontSize: number) => {
    el.style.setProperty("--qcf-font-size", `${fontSize}px`);
    return Math.max(...textLines.map(line => line.getBoundingClientRect().width), 1);
  };
  let fontSize = 30;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const naturalWidth = widthAt(fontSize);
    const next = fontSize * (width / naturalWidth) * 0.985;
    if (!Number.isFinite(next) || next <= 0) break;
    if (Math.abs(next - fontSize) < 0.1) { fontSize = next; break; }
    fontSize = Math.min(58, next);
  }
  el.style.setProperty("--qcf-font-size", `${fontSize}px`);
  // The Madinah page is a compact portrait sheet.  A restrained line pitch
  // keeps the printed page proportionate instead of stretching it vertically.
  const rowHeight = fontSize * 1.48;
  el.style.setProperty("--qcf-row-height", `${rowHeight}px`);

  el.querySelectorAll<HTMLElement>(".qcf-line.is-text").forEach(line => {
    const inner = line.querySelector<HTMLElement>(".qcf-line-inner");
    line.classList.toggle("is-short", Boolean(inner && inner.getBoundingClientRect().width < width * 0.78));
  });
  el.querySelectorAll<HTMLElement>(".qcf-line.is-fit").forEach(line => {
    const inner = line.querySelector<HTMLElement>(".qcf-line-inner");
    if (!inner) return;
    inner.style.setProperty("font-size", "40px", "important");
    const naturalWidth = inner.getBoundingClientRect().width || 1;
    const isSurahHeader = line.dataset.kind === "surah_header";
    const maxWidth = width * (isSurahHeader ? 0.52 : 0.72);
    // QCF's surah-title glyph includes tall calligraphic marks. Keep it inside
    // the ornament instead of sizing it to the full grid row like body text.
    const size = Math.min(40 * (maxWidth / naturalWidth) * 0.96, rowHeight * (isSurahHeader ? 0.44 : 0.78));
    inner.style.setProperty("font-size", `${size}px`, "important");
  });
  el.classList.remove("is-measuring");
}

export default function MushafQcf({ page, zoom, retry, activeKey, playingKey, expectedAyat, surahNames, onSelect, onRetry }: Props) {
  const [data, setData] = useState<QcfPage | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const hostRef = useRef<HTMLDivElement>(null);
  const expectedRef = useRef(expectedAyat);
  const selectRef = useRef(onSelect);
  expectedRef.current = expectedAyat;
  selectRef.current = onSelect;

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    setData(null);
    setErrorMessage("");
    const load = async () => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const pageData = await getVerifiedPage(page, expectedRef.current);
          const fonts = new Set(pageData.lines.flatMap(line => line.words.map(word => word.font)));
          await Promise.all([...fonts].map(getFont));
          if (alive) { setData(pageData); setStatus("ready"); }
          return;
        } catch (error) {
          lastError = error;
          const verificationFailed = isIntegrityFailure(error);
          // Network/CDN or font failures get one quiet retry. Text-integrity
          // failures stay fail-closed and are reported without retrying bad data.
          if (verificationFailed || attempt === 1) break;
          await new Promise(resolve => window.setTimeout(resolve, 650));
          if (!alive) return;
        }
      }
      console.error(`Unable to load or verify QCF4 Mushaf page ${page}:`, lastError);
      if (!alive) return;
      setErrorMessage(getPageErrorMessage(page, lastError));
      setStatus("error");
    };
    void load();
    return () => { alive = false; };
  }, [page, retry]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || status !== "ready") return;
    let frame = 0;
    let alive = true;
    const fit = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => fitPage(el));
    };
    fit();
    void document.fonts.ready.then(() => { if (alive) fit(); });
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => { alive = false; observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, [data, status, zoom]);

  const expectedByKey = getAyahIndex(expectedAyat);
  const localAyat = useMemo(() => expectedAyat.filter(ayah => ayah.page === page), [expectedAyat, page]);
  const basmalaText = expectedByKey.get("1:1")?.text.replace(/[\uE000-\uF8FF\uFC00-\uFDFF]+$/u, "").trim() ?? "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
  const pageLineNumbers = data?.lines.map(line => line.line) ?? [];
  const openingPageOffset = page <= 2 && pageLineNumbers.length
    ? Math.max(0, Math.floor((15 - (Math.max(...pageLineNumbers) - Math.min(...pageLineNumbers) + 1)) / 2) + 1 - Math.min(...pageLineNumbers))
    : 0;
  const glyph = (code: number) => String.fromCodePoint(code);

  return <article className={`mushaf-scan-page qcf-scan-page${status === "error" ? " is-fallback" : ""}`} aria-label={`صفحة المصحف ${page.toLocaleString("ar-EG")}`}>
    <div className="qcf-page-zoom" style={{ width: `${zoom * 100}%` }}>
      <div ref={hostRef} className={`qcf-page${status === "ready" ? " is-ready" : ""}`} aria-busy={status === "loading"}>
        {status === "ready" && data?.lines.map(line => {
          const first = line.words[0];
          const gridRow = line.line + openingPageOffset;
          if (first?.type === "surah_header" || first?.type === "bismillah") {
            const isBismillah = first.type === "bismillah";
            return <div key={line.line} className={`qcf-line is-fit qcf-line-${first.type}`} data-kind={first.type} style={{ gridRow }}>
              <span className="qcf-line-inner" style={isBismillah ? undefined : { fontFamily: `"${first.font}"` }} lang={isBismillah ? "ar" : undefined} aria-label={isBismillah ? "بسم الله الرحمن الرحيم" : "اسم السورة"}>{isBismillah ? basmalaText : glyph(first.code)}</span>
            </div>;
          }
          return <div key={line.line} className="qcf-line is-text" style={{ gridRow }}>
            <span className="qcf-line-inner" lang="ar">
              {line.words.map((word, wordIndex) => {
                const key = word.verse_key;
                const isAyahWord = (word.type === "word" || word.type === "end") && Boolean(key);
                const [surah, ayah] = key?.split(":").map(Number) ?? [0, 0];
                const verse = key ? expectedByKey.get(key) : undefined;
                const isEnd = word.type === "end";
                const isActive = Boolean(key && key === activeKey);
                const isPlaying = Boolean(key && key === playingKey);
                const className = `qcf-word${isEnd ? " is-end" : ""}${isActive ? " is-selected" : ""}${isPlaying ? " is-playing" : ""}`;
                return <span key={`${line.line}-${wordIndex}`} className={className} style={{ fontFamily: `"${word.font}"` }}
                  role={isEnd ? "button" : undefined} tabIndex={isEnd ? 0 : undefined}
                  aria-label={isEnd && verse ? `اختيار الآية ${ayah.toLocaleString("ar-EG")} من سورة ${surahNames[surah] ?? ""}` : undefined}
                  aria-pressed={isEnd ? isActive : undefined}
                  title={isAyahWord ? `اضغط لاختيار الآية ${ayah.toLocaleString("ar-EG")}` : undefined}
                  onClick={isAyahWord ? () => selectRef.current(surah, ayah) : undefined}
                  onKeyDown={isEnd && isAyahWord ? event => {
                    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectRef.current(surah, ayah); }
                  } : undefined}>{glyph(word.code)}</span>;
              })}
            </span>
          </div>;
        })}
      </div>
    </div>
    {status === "loading" && <div className="qcf-page-message" role="status">جارٍ تحميل صفحة المصحف والتحقق من نصها…</div>}
    {status === "error" && <div className="qcf-page-error" role="alert"><BookOpen size={26} /><p>{errorMessage || `تعذّر فتح صفحة ${page.toLocaleString("ar-EG")}.`}</p><button type="button" onClick={onRetry}>إعادة المحاولة</button></div>}
    {status === "error" && localAyat.length > 0 && <section className="qcf-local-text" aria-label="آيات الصفحة من المصحف المحلي">
      <h3>القراءة من النص المحلي</h3>
      {localAyat.map(ayah => <button key={`${ayah.surah}:${ayah.number}`} type="button" lang="ar"
        aria-pressed={activeKey === `${ayah.surah}:${ayah.number}`}
        onClick={() => onSelect(ayah.surah, ayah.number)}>
        {ayah.text.replace(/[\uE000-\uF8FF\uFC00-\uFDFF]+$/u, "").trim()} <span>{ayah.number.toLocaleString("ar-EG")}</span>
      </button>)}
    </section>}
  </article>;
}
