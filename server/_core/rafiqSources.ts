type Candidate = { url: string; title: string; publisher: string };
export type RafiqSource = Candidate & { excerpt: string };

const dar = "https://www.dar-alifta.org";
const islamweb = "https://www.islamweb.net";
const darPublisher = "دار الإفتاء المصرية";
const knownCandidates: Candidate[] = [
  {
    url: islamweb + "/ar/fatwa/print.php?id=159303",
    title: "الطرق المعينة على تدبر القرآن الكريم",
    publisher: "إسلام ويب",
  },
  {
    url: dar + "/ar/articles/details/10087/" + encodeURIComponent("مفتي-الجمهورية-في-حديثه-الرمضاني-على-قناتي-dmc-والناس-القران-منهج-حياة-شامل-وهدا"),
    title: "تدبر القرآن — القرآن منهج حياة شامل وهداية للقلوب",
    publisher: darPublisher,
  },
  {
    url: islamweb + "/ar/fatwa/print.php?id=4831",
    title: "أحكام سجود السهو",
    publisher: "إسلام ويب",
  },
];

const stopWords = new Set(["كيف", "ابدا", "اريد", "ممكن", "علشان", "ماذا", "معني", "متي", "هل", "انت", "ليه", "يعني", "اشرح", "وضح", "متيقن", "متاكد", "متاكدين", "متاكدون", "الكلام", "كلام", "مصدر", "مصادر", "مصدره", "المصدر", "دليل", "الدليل", "الحكم", "حكم", "التاكد", "اتحقق", "طريقة", "يكون"]);
const stripTags = (value: string) => value.replace(/<[^>]*>/g, " ");

function decode(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, code: string) => {
    const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
    if (named[code.toLowerCase()] !== undefined) return named[code.toLowerCase()];
    const number = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
  });
}

function topicWords(text: string) {
  const normalized = text.toLowerCase().replace(/https?:\/\/\S+|\S+@\S+/g, " ")
    .replace(/[\p{M}ـ]/gu, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي");
  const words = normalized.match(/[\p{L}]{3,24}/gu) ?? [];
  const terms = words.map(word => word.replace(/^ال(?=.{3})/u, ""));
  return [...new Set(terms.filter((term, index) => !stopWords.has(term) && !stopWords.has(words[index])))];
}

function relevance(text: string, terms: string[]) {
  const words = topicWords(text);
  return terms.filter(term => words.some(word => word === term || word === "و" + term || word === "ب" + term || word === "ل" + term
    || (word.length >= 4 && term === "ا" + word))).length;
}

function publicLink(value: unknown) {
  if (typeof value !== "string" || value.length > 1700) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !/^[\w-]+(?:\.[\w-]+)+$/.test(url.hostname)
      || !/[a-z]$/i.test(url.hostname) || /\.(?:local|internal|localhost|test|invalid)$/i.test(url.hostname)) return null;
    url.hash = "";
    return url;
  } catch { return null; }
}

async function readPublicPage(url: string, signal: AbortSignal, limit: number) {
  let response = await fetch(url, { signal, redirect: "manual" });
  if ([301, 302, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location) return "";
    const destination = publicLink(new URL(location, url).href);
    const publisher = (value: string) => new URL(value).hostname.replace(/^www\./, "");
    if (!destination || publisher(destination.href) !== publisher(url) || !destination.pathname.startsWith("/ar/")) return "";
    await response.body?.cancel().catch(() => {});
    response = await fetch(destination.href, { signal, redirect: "manual" });
  }
  if (!response.ok || !response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return body + decoder.decode();
      bytes += value.byteLength;
      if (bytes > limit) return "";
      body += decoder.decode(value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); }
}

let darIndex: { until: number; articles: Promise<Candidate[]> } | undefined;
function publishedDarArticles() {
  if (darIndex && darIndex.until > Date.now()) return darIndex.articles;
  const index = {
    until: Date.now() + 12 * 60 * 60 * 1000,
    articles: readPublicPage(dar + "/ar/sitemap.xml", AbortSignal.timeout(8000), 6_000_000).then(xml => {
      const entries: Candidate[] = [];
      for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        const url = publicLink(decode(match[1]));
        if (!url || !["dar-alifta.org", "www.dar-alifta.org"].includes(url.hostname) || url.search) continue;
        const article = url.pathname.match(/^\/ar\/(?:fatwa|articles|fatwaresearch)\/details\/\d+\/([^/]+)\/?$/i);
        if (article) entries.push({ url: url.href, title: decodeURIComponent(article[1]).replace(/[-_]+/g, " "), publisher: darPublisher });
      }
      return entries;
    }).catch(() => []),
  };
  darIndex = index;
  void index.articles.then(entries => { if (!entries.length) index.until = Date.now() + 60_000; });
  return index.articles;
}

async function withinTime<T>(request: Promise<T>, timeoutMs: number, defaultValue: T) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request, new Promise<T>(resolve => { timer = setTimeout(resolve, timeoutMs, defaultValue); })]);
  } finally { clearTimeout(timer); }
}

async function sourceFromPage(candidate: Candidate, terms: string[]) {
  try {
    const html = await readPublicPage(candidate.url, AbortSignal.timeout(2600), 512_000);
    if (!html) return null;
    const title = decode(stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""))
      .replace(/\s*[-–]\s*(?:دار الإفتاء المصرية|إسلام ويب).*$/u, "").trim();
    const body = html.replace(/<(head|script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
    const paragraphs = [...body.matchAll(/<(?:p|h2)\b[^>]*>([\s\S]*?)<\/(?:p|h2)>/gi)]
      .map(match => decode(stripTags(match[1])).replace(/\s+/g, " ").trim())
      .map(text => ({ text, score: relevance(text, terms) }))
      .filter(item => item.text.length >= 55 && item.score > 0)
      .sort((left, right) => right.score - left.score);
    const excerpt = paragraphs.slice(0, 2).map(item => item.text.slice(0, 420)).join("\n");
    return excerpt ? { ...candidate, title: title.length >= 8 ? title.slice(0, 160) : candidate.title, excerpt } : null;
  } catch { return null; }
}

async function searchPublicWeb(terms: string[]): Promise<RafiqSource[]> {
  const key = process.env.RAFIQ_WEB_SEARCH_KEY?.trim();
  if (!key) return [];
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      redirect: "error",
      headers: { authorization: "Bearer " + key, "content-type": "application/json" },
      signal: AbortSignal.timeout(2900),
      body: JSON.stringify({
        query: terms.join(" "),
        search_depth: "basic",
        max_results: 4,
        include_answer: false,
        include_raw_content: false,
        auto_parameters: false,
        safe_search: true,
      }),
    });
    if (!response.ok) return [];
    const { results } = await response.json() as { results?: { title?: unknown; url?: unknown; content?: unknown; score?: unknown }[] };
    return (Array.isArray(results) ? results : []).flatMap(item => {
      const url = publicLink(item.url);
      if (!url || typeof item.title !== "string" || typeof item.content !== "string" || typeof item.score !== "number" || item.score < 0.45) return [];
      const excerpt = decode(stripTags(item.content)).slice(0, 650);
      if (!excerpt.trim() || !relevance(item.title + " " + excerpt, terms)) return [];
      return [{ title: decode(stripTags(item.title)).slice(0, 160), url: url.href, publisher: url.hostname.replace(/^www\./, ""), excerpt }];
    });
  } catch { return []; }
}

const cachedSources = new Map<string, { until: number; sources: RafiqSource[] }>();

export async function getRafiqSources(questions: string[]) {
  const terms = questions.map(topicWords).find(words => words.length > 0)?.slice(0, 4) ?? [];
  if (!terms.length) return [];
  const key = terms.join(" ");
  const cached = cachedSources.get(key);
  if (cached && cached.until > Date.now()) return cached.sources;
  const index = publishedDarArticles();
  const known = knownCandidates.filter(candidate => relevance(candidate.title, terms) >= Math.min(2, terms.length));
  const knownPages = Promise.all(known.slice(0, 2).map(candidate => sourceFromPage(candidate, terms)));
  const web = searchPublicWeb(terms);
  const indexed = (async () => {
    if (known.length >= 2) return [];
    const entries = await withinTime(index, 1500, []);
    const ranked = entries.map(candidate => ({ candidate, score: relevance(candidate.title, terms) }))
      .filter(item => item.score >= Math.min(2, terms.length))
      .sort((left, right) => right.score - left.score);
    return Promise.all(ranked.slice(0, 2 - known.length).map(item => sourceFromPage(item.candidate, terms)));
  })();
  const [direct, discovered, general] = await Promise.all([knownPages, indexed, web]);
  const combined = [...direct, ...discovered, ...general].filter((source): source is RafiqSource => source !== null);
  const selected = new Map<string, RafiqSource>();
  for (const source of combined) if (!selected.has(source.publisher) && source.title.trim()) selected.set(source.publisher, source);
  const sources = [...selected.values()].slice(0, 3);
  if (sources.length) {
    const oldest = cachedSources.keys().next().value;
    if (cachedSources.size >= 96 && oldest !== undefined) cachedSources.delete(oldest);
    cachedSources.set(key, { until: Date.now() + 10 * 60 * 1000, sources });
  }
  return sources;
}
