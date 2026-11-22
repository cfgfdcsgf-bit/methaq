import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { Bookmark, BookOpen, ChevronLeft, ChevronRight, FileText, Headphones, Minus, Plus, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useSearch } from "wouter";
import PrintedMushafPage, { PRINT_PAGE_ROOT, type PrintVerseRegion } from "./PrintedMushafPage";

import WardReader from "@/components/WardReader";
import { saveWardCursor } from "@/lib/khatma";
import "@/quran-reader.css";

type Surah = { number: number; name: string; ayahCount: number };
type Ayah = { surah: number; number: number; text: string; plainText: string; normalizedText: string; page: number; juz: number; lineStart: number; lineEnd: number; globalNumber: number };
type Reciter = { id: string; name: string };
type AudioTarget = { kind: "surah"; surah: number } | { kind: "ayah" | "from-ayah"; surah: number; globalNumber: number };
type AudioTrack = { globalNumber: number; numberInSurah: number; urls: string[] };
type AudioSession = { requestId: number; mode: AudioTarget["kind"]; surah: number; reciterId: string; tracks: AudioTrack[]; index: number; urlIndex: number };
type TafsirState = { key: string; status: "loading" | "ready" | "error"; text?: string };
type PageTurnDirection = "next" | "previous";
type MushafLayout = "single" | "spread";
type Paper = "natural" | "sepia" | "night";
const tafsirEditions = { "ar.muyassar": "التفسير الميسّر", "ar.jalalayn": "تفسير الجلالين" } as const;
type TafsirEdition = keyof typeof tafsirEditions;
const printCache = "meethaq-mushaf-print-be0091b2";
const pagePath = (page: number) => `${PRINT_PAGE_ROOT}/${String(page).padStart(3, "0")}.webp`;

function readMarks(): number[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem("meethaq-quran-marks") ?? "[]");
    return Array.isArray(saved) ? [...new Set(saved.filter((page): page is number => Number.isInteger(page) && page >= 1 && page <= TOTAL_PAGES))] : [];
  } catch { return []; }
}

const QURAN_DATA_URL = "/data/quran/quran-hafs.tsv";
const TOTAL_PAGES = 604;
const FALLBACK_RECITERS: Reciter[] = [
  { id: "ar.alafasy", name: "مشاري العفاسي" },
  { id: "ar.husary", name: "محمود خليل الحصري" },
  { id: "ar.minshawi", name: "محمد صديق المنشاوي" },
  { id: "ar.sudais", name: "عبدالرحمن السديس" },
  { id: "ar.shuraim", name: "سعود الشريم" },
  { id: "ar.abdulbasit", name: "عبد الباسط عبد الصمد" },
  { id: "ar.abdulbasitmujawwad", name: "عبد الباسط عبد الصمد · مجوّد" },
  { id: "ar.minshawimujawwad", name: "محمد صديق المنشاوي · مجوّد" },
  { id: "ar.ajamy", name: "أحمد العجمي" },
  { id: "ar.muhammadayoub", name: "محمد أيوب" },
  { id: "ar.hudhaify", name: "علي الحذيفي" },
  { id: "ar.muhammadjibreel", name: "محمد جبريل" },
  { id: "ar.parhizgar", name: "شهريار پرهيزكار" },
];

function removeDiacritics(text: string) {
  return text.normalize("NFD").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").toLowerCase();
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

function storedMushafLayout(): MushafLayout {
  try {
    const saved = localStorage.getItem("quranMushafLayout");
    if (saved === "single" || saved === "spread") return saved;
    return window.matchMedia?.("(max-width: 800px)").matches ? "single" : "spread";
  } catch {
    return typeof window !== "undefined" && window.matchMedia?.("(max-width: 800px)").matches ? "single" : "spread";
  }
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
    const lineStart = Number(columns[6]);
    const lineEnd = Number(columns[7]);
    const number = Number(columns[8]);
    const name = columns[5];
    const text = columns[9].replace(/^\uFEFF/, "").trim();
    if (!Number.isInteger(globalNumber) || !Number.isInteger(page) || !Number.isInteger(surah) || !Number.isInteger(number) || !name || !text) continue;
    const existing = surahMap.get(surah);
    surahMap.set(surah, { number: surah, name, ayahCount: (existing?.ayahCount ?? 0) + 1 });
    verses.push({ surah, number, text, plainText: removeDiacritics(columns[10]), normalizedText: removeDiacritics(displayAyahText(text)), page, juz, lineStart, lineEnd, globalNumber });
  }
  return { surahs: [...surahMap.values()], verses };
}

function displayAyahText(text: string) {
  // The source file's ayah end signs are in the Arabic presentation-form range (FC00+).
  // Remove the source ornament; this reader draws its own accessible ayah marker.
  return text.replace(/[\uE000-\uF8FF\uFC00-\uFDFF]+$/u, "").trim();
}

function getAyahTracks(data: unknown): AudioTrack[] {
  const payload = data as { code?: number; data?: { ayahs?: Array<{ number?: number; numberInSurah?: number; audio?: string | null; audioSecondary?: string[] }> } };
  if (payload.code !== 200 || !Array.isArray(payload.data?.ayahs)) throw new Error("Audio edition unavailable");
  return payload.data.ayahs.flatMap(ayah => {
    const urls = [ayah.audio, ...(Array.isArray(ayah.audioSecondary) ? ayah.audioSecondary : [])]
      .filter((url): url is string => typeof url === "string" && /^https:\/\//.test(url));
    const globalNumber = Number(ayah.number);
    const numberInSurah = Number(ayah.numberInSurah);
    return Number.isInteger(globalNumber) && Number.isInteger(numberInSurah) && urls.length
      ? [{ globalNumber, numberInSurah, urls: [...new Set(urls)] }]
      : [];
  });
}

function QuranReaderView({ active }: { active: boolean }) {
  const search = useSearch();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [ayat, setAyat] = useState<Ayah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState(1);
  const [selectedPage, setSelectedPage] = useState(storedPage);
  const [mushafLayout, setMushafLayout] = useState<MushafLayout>(storedMushafLayout);
  const [marks, setMarks] = useState(readMarks);
  const [paper, setPaper] = useState<Paper>(() => {
    try {
      const stored = localStorage.getItem("meethaq-quran-paper");
      if (stored === "night" || stored === "sepia") return stored;
    } catch { /* Use the original page colors. */ }
    return "natural";
  });
  const [downloadJuz, setDownloadJuz] = useState(1);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const activeDownload = useRef<{ cancelled: boolean } | null>(null);
  const [pageTurnDirection, setPageTurnDirection] = useState<PageTurnDirection>("next");
  const [printRegions, setPrintRegions] = useState<PrintVerseRegion[][]>([]);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(() => {
    try { return Math.min(2, Math.max(.8, Number(localStorage.getItem("quranMushafZoom")) || 1)); }
    catch { return 1; }
  });
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [activeAyah, setActiveAyah] = useState<Ayah | null>(null);
  const [studyOpen, setStudyOpen] = useState(false);
  const showStudy = active && studyOpen;
  const [studyPlacement, setStudyPlacement] = useState<"left" | "right">("left");
  const [tafsir, setTafsir] = useState<TafsirState | null>(null);
  const [tafsirEdition, setTafsirEdition] = useState<TafsirEdition>("ar.muyassar");
  const [audioSpeed, setAudioSpeed] = useState(1);
  const audioElement = useRef<HTMLAudioElement>(null);
  const [reciters, setReciters] = useState<Reciter[]>(FALLBACK_RECITERS);
  const [reciter, setReciter] = useState(FALLBACK_RECITERS[0].id);
  const [audioSession, setAudioSession] = useState<AudioSession | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioStatus, setAudioStatus] = useState("");
  const audioRequestId = useRef(0);
  const tafsirRequestId = useRef(0);
  const touchStartX = useRef<number | null>(null);
  const verseStudyHeading = useRef<HTMLHeadingElement>(null);
  const studyTrigger = useRef<HTMLElement | null>(null);
  const drawer = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${PRINT_PAGE_ROOT}/ayah-regions.json`, { signal: controller.signal, cache: "force-cache" })
      .then(response => {
        if (!response.ok) throw new Error("Printed Mushaf regions unavailable");
        return response.json() as Promise<PrintVerseRegion[][]>;
      })
      .then(regions => {
        if (!Array.isArray(regions) || regions.length !== TOTAL_PAGES) throw new Error("Incomplete printed Mushaf regions");
        setPrintRegions(regions);
      })
      .catch(error => { if (!controller.signal.aborted) console.error(error); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!studyOpen) return;
    verseStudyHeading.current?.focus({ preventScroll: true });
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setStudyOpen(false);
        studyTrigger.current?.focus({ preventScroll: true });
      }
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [studyOpen]);

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
    let cancelled = false;
    fetch("https://api.alquran.cloud/v1/edition/format/audio?language=ar&type=versebyverse", { cache: "force-cache" })
      .then(response => {
        if (!response.ok) throw new Error("Audio reciters unavailable");
        return response.json();
      })
      .then(result => {
        const payload = result as { code?: number; data?: Array<{ identifier?: string; name?: string; englishName?: string; language?: string; format?: string; type?: string }> };
        const available = payload.data?.filter(item => item.identifier?.startsWith("ar.") && item.format === "audio" && item.language === "ar" && item.type === "versebyverse")
          .map(item => ({ id: item.identifier!, name: item.name || item.englishName || item.identifier! })) ?? [];
        if (!cancelled && payload.code === 200 && available.length) {
          setReciters(available);
          setReciter(current => available.some(item => item.id === current) ? current : available[0].id);
        }
      })
      .catch(() => { /* The curated fallback list remains usable if the directory is offline. */ });
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
    return ayat.filter(verse => verse.plainText.includes(normalizedQuery) || verse.normalizedText.includes(normalizedQuery)).slice(0, 80);
  }, [ayat, normalizedQuery]);
  const pageAyat = useMemo(() => ayat.filter(verse => verse.page === selectedPage), [ayat, selectedPage]);
  const spreadStart = selectedPage % 2 === 0 ? selectedPage - 1 : selectedPage;
  const zoomedSinglePage = mushafLayout === "spread" && zoom > 1;
  const effectiveSinglePage = mushafLayout === "single" || zoomedSinglePage;
  const visiblePages = (effectiveSinglePage ? [selectedPage] : [spreadStart, spreadStart + 1]).filter(page => page <= TOTAL_PAGES);
  const visibleAyah = activeAyah && visiblePages.some(page =>
    printRegions[page - 1]?.some(([id]) => id === activeAyah.globalNumber)) ? activeAyah : null;
  const selectedReciter = reciters.find(item => item.id === reciter) ?? reciters[0];
  const surahNames = useMemo(() => Object.fromEntries(surahs.map(surah => [surah.number, surah.name])) as Record<number, string>, [surahs]);
  const verseLabel = (id: number) => {
    const verse = ayat[id - 1];
    return verse && `سورة ${surahNames[verse.surah]} · الآية ${verse.number.toLocaleString("ar-EG")}`;
  };
  const currentAudioTrack = audioSession?.tracks[audioSession.index];
  const playingAyah = currentAudioTrack ? ayat.find(verse => verse.globalNumber === currentAudioTrack.globalNumber) ?? null : null;
  const audioSource = currentAudioTrack?.urls[audioSession?.urlIndex ?? 0] ?? "";
  const audioTitle = audioSession?.mode === "surah"
    ? "تلاوة سورة " + (surahs.find(surah => surah.number === audioSession.surah)?.name ?? "")
    : audioSession?.mode === "from-ayah" && audioSession.tracks[0]
      ? "تلاوة من الآية " + audioSession.tracks[0].numberInSurah.toLocaleString("ar-EG")
      : currentAudioTrack ? "تلاوة الآية " + currentAudioTrack.numberInSurah.toLocaleString("ar-EG") : "";

  function savePage(page: number, direction?: PageTurnDirection) {
    const nextPage = Math.min(TOTAL_PAGES, Math.max(1, page));
    if (nextPage === selectedPage) return;
    const currentSpread = selectedPage % 2 === 0 ? selectedPage - 1 : selectedPage;
    const nextSpread = nextPage % 2 === 0 ? nextPage - 1 : nextPage;
    const currentTurnPosition = effectiveSinglePage ? selectedPage : currentSpread;
    const nextTurnPosition = effectiveSinglePage ? nextPage : nextSpread;
    if (currentTurnPosition !== nextTurnPosition) setPageTurnDirection(direction ?? (nextTurnPosition > currentTurnPosition ? "next" : "previous"));
    setSelectedPage(nextPage);
    try { localStorage.setItem("quranPage", String(nextPage));
    if (new URLSearchParams(search).get("ward") === "1") saveWardCursor(nextPage); } catch { /* local storage is optional */ }
    const first = ayat.find(verse => verse.page === nextPage);
    if (first) setSelectedSurah(first.surah);
  }

  function changeMushafLayout(layout: MushafLayout) {
    setMushafLayout(layout);
    try { localStorage.setItem("quranMushafLayout", layout); } catch { /* local storage is optional */ }
  }

  function navigatePage(direction: PageTurnDirection) {
    if (effectiveSinglePage) savePage(selectedPage + (direction === "next" ? 1 : -1), direction);
    else savePage(spreadStart + (direction === "next" ? 2 : -2), direction);
  }

  function selectSurah(number: number) {
    const first = ayat.find(verse => verse.surah === number);
    if (!first) return;
    savePage(first.page);
    setSelectedSurah(number);
    setActiveAyah(first);
    tafsirRequestId.current += 1;
    setTafsir(null);
    setQuery("");
  }

  function changeZoom(delta: number) {
    const next = Math.round(Math.min(2, Math.max(.8, zoom + delta)) * 100) / 100;
    setZoom(next);
    try { localStorage.setItem("quranMushafZoom", String(next)); } catch { /* local storage is optional */ }
  }

  function followAyah(verse: Ayah, page = verse.page) {
    tafsirRequestId.current += 1;
    if (page !== selectedPage) savePage(page);
    setSelectedSurah(verse.surah);
    setActiveAyah(verse);
  }

  function openAyah(verse: Ayah, trigger: HTMLElement, page = verse.page) {
    studyTrigger.current = trigger;
    const rect = trigger.getBoundingClientRect();
    setStudyPlacement(rect.left + rect.width / 2 < window.innerWidth / 2 ? "right" : "left");
    followAyah(verse, page);
    setQuery("");
    setStudyOpen(true);
    void loadTafsir(verse);
  }

  function savePosition() {
    const verse = (visibleAyah?.page === selectedPage ? visibleAyah : null) ?? pageAyat[0];
    if (!verse) return;
    const name = surahs.find(surah => surah.number === verse.surah)?.name ?? "";
    try {
      localStorage.setItem("lastRead", JSON.stringify({ kind: "quran", surah: verse.surah, ayah: verse.number, page: verse.page, title: "سورة " + name + " · الآية " + verse.number.toLocaleString("ar-EG") }));
      localStorage.setItem("quranPage", String(verse.page));
      toast.success("حُفظ موضع القراءة");
    } catch { toast.error("تعذّر حفظ موضع القراءة على هذا الجهاز"); }
  }

  function toggleMark() {
    const next = marks.includes(selectedPage) ? marks.filter(page => page !== selectedPage) : [...marks, selectedPage].sort((a, b) => a - b);
    try {
      localStorage.setItem("meethaq-quran-marks", JSON.stringify(next));
      setMarks(next);
    } catch { toast.error("تعذّر حفظ العلامة على الجهاز"); }
  }

  async function saveOfflinePages(fullMushaf: boolean) {
    const ready = "serviceWorker" in navigator && navigator.serviceWorker.controller && "caches" in window;
    if (!ready) {
      setDownloadStatus("أعد فتح المصحف بعد اكتمال تثبيت مِيثَاق في المتصفح.");
      return;
    }
    const pages = fullMushaf
      ? Array.from({ length: TOTAL_PAGES }, (_, index) => index + 1)
      : [...new Set(ayat.filter(verse => verse.juz === downloadJuz).map(verse => verse.page))];
    if (!pages.length || activeDownload.current) return;
    const job = { cancelled: false };
    activeDownload.current = job;
    const label = fullMushaf ? "المصحف كاملًا" : `الجزء ${downloadJuz.toLocaleString("ar-EG")}`;
    setDownloadBusy(true);
    setDownloadStatus("جارٍ تجهيز التنزيل…");
    try {
      const cache = await caches.open(printCache);
      const cached = new Set((await cache.keys()).map(request => new URL(request.url).pathname));
      const missing = pages.map(pagePath).filter(url => !cached.has(url));
      const count = new Intl.NumberFormat("ar-EG", { useGrouping: false });
      for (let offset = 0; offset < missing.length; offset += 8) {
        if (job.cancelled) break;
        const batch = missing.slice(offset, offset + 8);
        await cache.addAll(batch);
        const totalSaved = pages.length - missing.length + offset + batch.length;
        setDownloadStatus(`حُفظت ${count.format(totalSaved)} من ${count.format(pages.length)} صفحة.`);
      }
      setDownloadStatus(job.cancelled ? "توقّف التنزيل. الصفحات المحفوظة متاحة، ويمكنك استكمال الباقي."
        : `${label} جاهز للقراءة بلا اتصال على هذا الجهاز.`);
    } catch {
      setDownloadStatus("تعذّر استكمال التنزيل. تحقّق من الاتصال ومساحة التخزين، ثم أعد المحاولة لاستكمال الصفحات الناقصة.");
    } finally {
      activeDownload.current = null;
      setDownloadBusy(false);
    }
  }

  async function loadTafsir(verse: Ayah, edition = tafsirEdition) {
    const requestId = ++tafsirRequestId.current;
    const key = verse.surah + ":" + verse.number;
    setActiveAyah(verse);
    setTafsir({ key, status: "loading" });
    try {
      const response = await fetch("https://api.alquran.cloud/v1/ayah/" + verse.surah + ":" + verse.number + "/" + edition, { cache: "force-cache" });
      if (!response.ok) throw new Error("Tafsir unavailable");
      const result = await response.json() as { code?: number; data?: { text?: string } };
      if (result.code !== 200 || !result.data?.text) throw new Error("Tafsir unavailable");
      if (requestId === tafsirRequestId.current) setTafsir({ key, status: "ready", text: result.data.text });
    } catch {
      if (requestId === tafsirRequestId.current) setTafsir({ key, status: "error" });
    }
  }

  async function startAudio(target: AudioTarget) {
    const requestId = ++audioRequestId.current;
    setAudioSession(null);
    setAudioLoading(true);
    setAudioStatus("جارٍ تجهيز التلاوة…");
    try {
      const response = await fetch("https://api.alquran.cloud/v1/surah/" + target.surah + "/" + encodeURIComponent(reciter), { cache: "force-cache" });
      if (!response.ok) throw new Error("Audio unavailable");
      const tracks = getAyahTracks(await response.json());
      const requestedIndex = target.kind !== "surah" ? tracks.findIndex(track => track.globalNumber === target.globalNumber) : 0;
      if (requestedIndex < 0 || !tracks.length) throw new Error("No audio tracks");
      const playbackTracks = target.kind === "ayah" ? [tracks[requestedIndex]] : target.kind === "from-ayah" ? tracks.slice(requestedIndex) : tracks;
      const startTrack = playbackTracks[0];
      const startAyah = ayat.find(verse => verse.globalNumber === startTrack.globalNumber);
      if (!startAyah) throw new Error("Audio verse unavailable");
      if (requestId !== audioRequestId.current) return;
      setAudioSession({ requestId, mode: target.kind, surah: target.surah, reciterId: reciter, tracks: playbackTracks, index: 0, urlIndex: 0 });
      setAudioStatus("");
      if (startAyah.globalNumber !== activeAyah?.globalNumber) followAyah(startAyah);
    } catch {
      if (requestId === audioRequestId.current) setAudioStatus("تعذّر تجهيز التلاوة الآن. جرّب قارئًا آخر أو أعد المحاولة لاحقًا.");
    } finally {
      if (requestId === audioRequestId.current) setAudioLoading(false);
    }
  }

  function handleAudioEnded() {
    if (!audioSession) return;
    const nextIndex = audioSession.index + 1;
    if (nextIndex >= audioSession.tracks.length) {
      setAudioStatus("اكتملت التلاوة.");
      return;
    }
    const nextTrack = audioSession.tracks[nextIndex];
    const nextAyah = ayat.find(verse => verse.globalNumber === nextTrack.globalNumber);
    setAudioSession(current => current?.requestId === audioSession.requestId
      ? { ...current, index: nextIndex, urlIndex: 0 }
      : current);
    if (nextAyah) followAyah(nextAyah);
    setAudioStatus("");
  }

  function handleAudioError() {
    if (!audioSession || !currentAudioTrack) return;
    if (audioSession.urlIndex + 1 < currentAudioTrack.urls.length) {
      setAudioSession(current => current?.requestId === audioSession.requestId && current.urlIndex === audioSession.urlIndex
        ? { ...current, urlIndex: current.urlIndex + 1 }
        : current);
      setAudioStatus("نجرب مسارًا صوتيًا بديلًا…");
    } else {
      setAudioSession(null);
      setAudioStatus("تعذّر تشغيل التلاوة لهذا القارئ الآن. جرّب قارئًا آخر.");
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStartX.current;
    touchStartX.current = null;
    const end = event.changedTouches[0]?.clientX;
    if (start === null || end === undefined || Math.abs(end - start) < 55) return;
    if (end < start) navigatePage("next");
    else navigatePage("previous");
  }

  function changeReciter(id: string) {
    audioRequestId.current += 1;
    setReciter(id);
    setAudioSession(null);
    setAudioLoading(false);
    setAudioStatus("");
  }

  function closeVerseStudy() {
    setStudyOpen(false);
    if (!audioSession) setAudioStatus("");
    studyTrigger.current?.focus({ preventScroll: true });
  }

  return <section className="quran-reader-panel" id="quran-reader" aria-labelledby="quran-reader-title" translate="no">
    <header className="quran-reader-heading">
      <div className="quran-reader-title">
        <span className="quran-reader-emblem" aria-hidden="true"><BookOpen size={24} /></span>
        <div><h1 id="quran-reader-title">المصحف الشريف</h1><p><span className="quran-edition-name">مصحف المدينة النبوية · </span>رواية حفص عن عاصم</p></div>
      </div>
      <button type="button" className="quran-bookmark-button" aria-label="حفظ موضعي" title="حفظ موضعي" onClick={savePosition} disabled={loadState !== "ready"}><Bookmark size={17} aria-hidden="true" /><span>حفظ موضعي</span></button>
    </header>

    <div className="quran-reader-controls">
      <label className="quran-surah-picker"><BookOpen size={17} aria-hidden="true" />
        <select aria-label="اختر السورة" value={selectedSurah} onChange={event => selectSurah(Number(event.target.value))} disabled={loadState !== "ready"}>
          {surahs.map(surah => <option key={surah.number} value={surah.number}>{surah.number.toLocaleString("ar-EG")} · {surah.name}</option>)}
        </select>
      </label>
      <label className="quran-page-picker"><FileText size={17} aria-hidden="true" />
        <select aria-label="انتقل إلى صفحة من المصحف" value={selectedPage} onChange={event => savePage(Number(event.target.value))} disabled={loadState !== "ready"}>
          {Array.from({ length: TOTAL_PAGES }, (_, index) => index + 1).map(page => <option key={page} value={page}>{page.toLocaleString("ar-EG")}</option>)}
        </select>
      </label>
      <label className="quran-search"><Search size={17} aria-hidden="true" /><span className="sr-only">ابحث في آيات القرآن</span>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث في آيات المصحف…" disabled={loadState !== "ready"} />
      </label>
      <details className="quran-display-options" onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }} onKeyDown={event => {
        if (event.key === "Escape" && event.currentTarget.open) {
          event.stopPropagation();
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}>
        <summary><SlidersHorizontal size={17} aria-hidden="true" /><span>العرض</span></summary>
        <div className="quran-reader-toolbar">
          <div className="quran-toolbar-section">
            <span className="quran-toolbar-label">عرض الصفحة</span>
            <div className="quran-view-switch" role="group" aria-label="عدد الصفحات المعروضة">
              <button type="button" aria-pressed={effectiveSinglePage} onClick={() => changeMushafLayout("single")}>صفحة واحدة</button>
              <button type="button" aria-pressed={!effectiveSinglePage} onClick={() => { changeMushafLayout("spread"); if (zoom !== 1) changeZoom(1 - zoom); }}>صفحتان</button>
            </div>
          </div>
          <div className="quran-toolbar-section quran-zoom-tools" role="group" aria-label="تكبير صفحات المصحف">
            <span className="quran-toolbar-label">التكبير</span>
            <div className="quran-zoom-switch">
              <button type="button" onClick={() => changeZoom(-.1)} disabled={zoom <= .8} aria-label="تصغير صفحة المصحف"><Minus size={17} /></button>
              <span aria-live="polite">{Math.round(zoom * 100).toLocaleString("ar-EG")}٪</span>
              <button type="button" onClick={() => changeZoom(.1)} disabled={zoom >= 2} aria-label="تكبير صفحة المصحف"><Plus size={17} /></button>
              <button type="button" onClick={() => changeZoom(1 - zoom)} disabled={zoom === 1} aria-label="إعادة حجم الصفحة الطبيعي" title="الحجم الطبيعي"><RotateCcw size={15} /></button>
            </div>
          </div>
          <label className="mushaf-page-range">
            <span>انتقل إلى صفحة</span>
            <input type="range" min={1} max={TOTAL_PAGES} value={selectedPage} onChange={event => savePage(Number(event.target.value))} disabled={loadState !== "ready"} aria-label="اختر رقم صفحة المصحف" />
            <b dir="rtl">{selectedPage.toLocaleString("ar-EG")} من {TOTAL_PAGES.toLocaleString("ar-EG")}</b>
          </label>
          <div className="quran-toolbar-section quran-extra-controls">
            <label>لون الورق <select value={paper} onChange={event => {
              const value = event.target.value as Paper;
              setPaper(value);
              try { localStorage.setItem("meethaq-quran-paper", value); } catch { /* Session preference. */ }
            }}><option value="natural">الطبعة الأصلية</option><option value="sepia">ورق دافئ</option><option value="night">ليلي</option></select></label>
            <button type="button" aria-pressed={marks.includes(selectedPage)} disabled={loadState !== "ready"} onClick={toggleMark}>
              {marks.includes(selectedPage) ? "إزالة علامة الصفحة" : "إضافة علامة للصفحة"}
            </button>
            {marks.length > 0 && <label>العلامات <select value={marks.includes(selectedPage) ? selectedPage : ""} onChange={event => { if (event.target.value) savePage(Number(event.target.value)); }}>
              <option value="">اختر صفحة محفوظة</option>
              {marks.map(page => <option key={page} value={page}>صفحة {page.toLocaleString("ar-EG")}</option>)}
            </select></label>}
            <label>الجزء <select value={downloadJuz} disabled={downloadBusy} onChange={event => { setDownloadJuz(Number(event.target.value)); setDownloadStatus(""); }}>
              {Array.from({ length: 30 }, (_, index) => index + 1).map(juz => <option key={juz} value={juz}>{juz.toLocaleString("ar-EG")}</option>)}
            </select></label>
            <button type="button" onClick={() => void saveOfflinePages(false)} disabled={downloadBusy || loadState !== "ready"}>تنزيل الجزء للقراءة بلا اتصال</button>
            <button type="button" onClick={() => void saveOfflinePages(true)} disabled={downloadBusy || loadState !== "ready"}>تنزيل المصحف كاملًا · نحو ١٧٦ م.ب</button>
            {downloadBusy && <button type="button" onClick={() => {
              if (activeDownload.current) activeDownload.current.cancelled = true;
            }}>إيقاف التنزيل</button>}
            {downloadStatus && <span role="status">{downloadStatus}</span>}
          </div>
        </div>
      </details>
    </div>

    {loadState === "loading" && <div className="quran-reader-message" role="status">جارٍ تجهيز صفحات المصحف…</div>}
    {loadState === "error" && <div className="quran-reader-message is-error" role="alert">تعذّر تحميل نص المصحف المحلي أو اجتياز فحص سلامته؛ لم نعرض نصًا بديلًا.</div>}
    {loadState === "ready" && <>
      {normalizedQuery && <section className="quran-search-panel" aria-label="نتائج البحث في القرآن">
      <div className="quran-search-summary" role="status">{searchResults.length ? "نتائج البحث: " + searchResults.length.toLocaleString("ar-EG") + (searchResults.length === 80 ? " (أول ٨٠ نتيجة)" : "") : "لا توجد آيات مطابقة."}</div>
      <div className="mushaf-search-results">
        {searchResults.map(verse => <button type="button" key={verse.globalNumber} onClick={event => openAyah(verse, event.currentTarget)}>
          <span>{displayAyahText(verse.text)}</span>
          <small>سورة {surahs.find(surah => surah.number === verse.surah)?.name} · الآية {verse.number.toLocaleString("ar-EG")} · الصفحة {verse.page.toLocaleString("ar-EG")}</small>
        </button>)}
      </div>
      </section>}
      <div className="mushaf-reader-stage">
      <div className="mushaf-page-column">
        <nav className="mushaf-page-nav" aria-label="التنقل بين صفحات المصحف">
          <button type="button" onClick={() => navigatePage("previous")} disabled={(effectiveSinglePage ? selectedPage : spreadStart) <= 1}><ChevronRight size={19} /> السابق</button>
          <span className="mushaf-page-position" aria-live="polite">
            {effectiveSinglePage ? "صفحة " + selectedPage.toLocaleString("ar-EG") : "صفحتا " + spreadStart.toLocaleString("ar-EG") + "–" + visiblePages.at(-1)?.toLocaleString("ar-EG")}
            <small>من {TOTAL_PAGES.toLocaleString("ar-EG")}</small>
          </span>
          <button type="button" onClick={() => navigatePage("next")} disabled={visiblePages.at(-1) === TOTAL_PAGES}>التالي <ChevronLeft size={19} /></button>
        </nav>
        <label className="quran-surah-picker mushaf-ayah-picker">
          <span>اختر آية للتفسير والتلاوة</span>
          <select value="" onChange={event => {
            const verse = ayat[Number(event.target.value) - 1];
            if (verse) openAyah(verse, event.currentTarget);
          }}>
            <option value="">آيات الصفحات المعروضة</option>
            {visiblePages.flatMap(page => (printRegions[page - 1] ?? []).map(([id]) => <option key={id} value={id}>{verseLabel(id)}</option>))}
          </select>
        </label>
        <div data-paper={paper} className={"mushaf-page-frame mushaf-facsimile-frame" + (effectiveSinglePage ? " is-single-page" : "")} style={effectiveSinglePage ? { maxWidth: `${500 * zoom}px`, touchAction: zoom > 1 ? "auto" : undefined } : undefined} onTouchStart={zoom > 1 ? undefined : handleTouchStart} onTouchEnd={zoom > 1 ? undefined : handleTouchEnd}>
          <div key={effectiveSinglePage ? selectedPage : spreadStart} className={"mushaf-open-book mushaf-scanned-book mushaf-facsimile-book" + (effectiveSinglePage ? " is-single-page" : "")} style={{ width: effectiveSinglePage ? `${Math.max(zoom, 1) * 100}%` : "100%", maxWidth: `${(effectiveSinglePage ? 460 : 920) * zoom}px` }} data-turn={pageTurnDirection} aria-label={effectiveSinglePage ? "صفحة المصحف" : "صفحتا المصحف"}>
            {visiblePages.map(pageNumber => <PrintedMushafPage key={pageNumber} page={pageNumber}
              regions={printRegions[pageNumber - 1] ?? []} selectedId={activeAyah?.globalNumber} playingId={audioStatus !== "اكتملت التلاوة." ? playingAyah?.globalNumber : undefined}
              verseLabel={verseLabel} onSelect={(id, button, line) => {
                const verse = ayat[id - 1];
                if (!verse) return;
                openAyah(verse, button, pageNumber);
                requestAnimationFrame(() => {
                  if (!window.matchMedia("(max-width: 700px)").matches || !drawer.current) return;
                  const highlightedLine = line?.getBoundingClientRect();
                  const panelTop = drawer.current.getBoundingClientRect().top;
                  if (highlightedLine && highlightedLine.bottom > panelTop - 12) {
                    window.scrollBy({ top: highlightedLine.bottom - panelTop + 12, behavior: "instant" });
                  }
                });
              }} />)}
          </div>
        </div>
        <p className="quran-print-credit">طبعة مجمع الملك فهد لطباعة المصحف الشريف · وقف لله تعالى</p>
        <section className="quran-listen-bar" aria-label="التلاوة">
          <label><Headphones size={18} /> القارئ
            <select value={reciter} onChange={event => changeReciter(event.target.value)}>
              {reciters.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => visibleAyah?.surah === selectedSurah
            ? void startAudio({ kind: "from-ayah", surah: visibleAyah.surah, globalNumber: visibleAyah.globalNumber })
            : void startAudio({ kind: "surah", surah: selectedSurah })} disabled={loadState !== "ready" || !activeSurah || audioLoading}>
            <BookOpen size={17} /> {visibleAyah?.surah === selectedSurah ? "استمع من الآية المختارة" : "استمع إلى السورة"}
          </button>
        </section>
      </div>

      {(showStudy || audioLoading || audioSession || audioStatus) && createPortal(
        <aside ref={drawer} className="quran-verse-study quran-verse-drawer" data-placement={studyPlacement} data-study={showStudy || undefined} dir="rtl" aria-label="التفسير والتلاوة" translate="no">
        <div className="quran-drawer-heading">
          <h3 ref={verseStudyHeading} tabIndex={-1}>{showStudy && activeAyah
            ? `سورة ${surahNames[activeAyah.surah]} · الآية ${activeAyah.number.toLocaleString("ar-EG")}`
            : "مشغّل التلاوة"}</h3>
          <button type="button" aria-label={showStudy ? "إغلاق التفسير" : "إغلاق مشغل التلاوة"} onClick={showStudy ? closeVerseStudy : () => {
            audioRequestId.current += 1;
            setAudioSession(null);
            setAudioLoading(false);
            setAudioStatus("");
          }}><X size={19} /></button>
        </div>
        {showStudy && activeAyah && <>
          <div className="quran-study-actions">
            <label className="quran-surah-picker"><span>القارئ</span><select value={reciter} onChange={event => changeReciter(event.target.value)}>
              {reciters.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
            <button type="button" disabled={audioLoading} onClick={() => void startAudio({ kind: "ayah", surah: activeAyah.surah, globalNumber: activeAyah.globalNumber })}><Headphones size={16} /> استمع للآية</button>
          </div>
          <blockquote className="quran-study-ayah" lang="ar">{displayAyahText(activeAyah.text)}</blockquote>
          <div className="quran-tafsir" aria-live="polite">
            <label className="quran-surah-picker">التفسير <select value={tafsirEdition} onChange={event => {
              const edition = event.target.value as TafsirEdition;
              setTafsirEdition(edition);
              void loadTafsir(activeAyah, edition);
            }}>{Object.entries(tafsirEditions).map(([edition, label]) => <option key={edition} value={edition}>{label}</option>)}</select></label>
            {tafsir?.key === activeAyah.surah + ":" + activeAyah.number && tafsir.status === "loading" && <p role="status">جارٍ تحميل التفسير…</p>}
            {tafsir?.key === activeAyah.surah + ":" + activeAyah.number && tafsir.status === "ready" && <p>{tafsir.text}</p>}
            {tafsir?.key === activeAyah.surah + ":" + activeAyah.number && tafsir.status === "error" && <p role="alert">تعذّر تحميل التفسير الآن.</p>}
            {(tafsir?.key !== activeAyah.surah + ":" + activeAyah.number || tafsir.status === "error") &&
              <div className="quran-study-actions"><button type="button" onClick={() => void loadTafsir(activeAyah)}>عرض التفسير</button></div>}
          </div>
        </>}
        {(audioLoading || audioSession || audioStatus) && <div className="quran-audio-player" aria-live="polite">
          <div className="quran-audio-meta"><span className="kicker">تلاوةٌ خاشعة</span><b>{audioTitle || (audioLoading ? "جارٍ تجهيز التلاوة" : "مشغل التلاوة")}</b>
            <small>{selectedReciter?.name}{currentAudioTrack ? " · الآية " + currentAudioTrack.numberInSurah.toLocaleString("ar-EG") : ""}</small>
          </div>
          {audioSource && <>
            <audio ref={audioElement} key={audioSession?.requestId + ":" + currentAudioTrack?.globalNumber + ":" + audioSession?.urlIndex} controls autoPlay preload="none" src={audioSource} onLoadedMetadata={event => { event.currentTarget.playbackRate = audioSpeed; }} onEnded={handleAudioEnded} onError={handleAudioError} aria-label={audioTitle} />
            <label className="quran-surah-picker">سرعة التلاوة <select value={audioSpeed} onChange={event => {
              const speed = Number(event.target.value);
              setAudioSpeed(speed);
              if (audioElement.current) audioElement.current.playbackRate = speed;
            }}>{[0.75, 1, 1.25, 1.5, 2].map(speed => <option key={speed} value={speed}>{speed.toLocaleString("ar-EG")}×</option>)}</select></label>
          </>}
          {audioLoading && <p className="quran-audio-status" role="status">جارٍ الاتصال بقراءة القارئ المختار…</p>}
          {audioStatus && <p className="quran-audio-status" role={audioSession ? "status" : "alert"}>{audioStatus}</p>}
        </div>}
      </aside>, document.body)}
    </div></>}
  </section>;
}

export default function QuranReader({ active = true }: { active?: boolean }) {
  const params = new URLSearchParams(useSearch());
  const ward = active && params.get("ward") === "1";
  return <>{ward && <WardReader />}<QuranReaderView active={active} />{ward && <LinkToWard />}</>;
}

function LinkToWard() {
  return <a className="detail-btn" href="#daily-ward-reader">العودة إلى متابعة الورد</a>;
}
