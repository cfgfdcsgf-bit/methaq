import { readFile } from "node:fs/promises";

const totalPages = 604;
const bases = [
  "https://cdn.jsdelivr.net/npm/quran-qcf4@1.1.0",
  "https://raw.githubusercontent.com/MohamadHajjRabee/quran-qcf4/main",
];

const source = await readFile(new URL("../client/public/data/quran/quran-hafs.tsv", import.meta.url), "utf8");
const ayat = new Map();
for (const line of source.split(/\r?\n/)) {
  if (!line || line.startsWith("id\t")) continue;
  const columns = line.split("\t");
  if (columns.length >= 11) ayat.set(`${columns[3]}:${columns[8]}`, columns[9].replace(/^\uFEFF/, "").trim());
}
const expected = new Map();
for (const [key, text] of ayat) expected.set(key, tokens(text));

function normalizeWord(text) {
  const normalized = text.normalize("NFD")
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
    .replace(/[^\u0621-\u064A\uE000]/g, "");
  let variants = [""];
  for (const character of normalized) {
    variants = character === "\uE000"
      ? variants.flatMap(value => [value, value + "ا"])
      : variants.map(value => value + character);
  }
  return new Set(variants.flatMap(value => [value, value.replace(/ءا/g, "ا")]).map(value => value
    .replace(/الءان/g, "الان")
    .replace(/الصلو(?:ا)?ة/g, "الصلاة")
    .replace(/الزكو(?:ا)?ة/g, "الزكاة")
    .replace(/الحيو(?:ا)?ة/g, "الحياة")
    .replace(/الربو(?:ا)?/g, "الربا")));
}

function tokens(text) {
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

function makeWordForms(words, maxGroup = 4) {
  return words.map((_, start) => {
    const groups = new Map();
    let forms = new Set([""]);
    for (let length = 1; length <= maxGroup && start + length <= words.length; length += 1) {
      const wordForms = normalizeWord(words[start + length - 1]);
      const combined = new Set();
      for (const prefix of forms) for (const suffix of wordForms) combined.add(prefix + suffix);
      forms = combined;
      groups.set(length, forms);
    }
    return groups;
  });
}

function formsIntersect(left, right) {
  const smaller = left.size < right.size ? left : right;
  const larger = smaller === left ? right : left;
  for (const value of smaller) if (larger.has(value)) return true;
  return false;
}

function matchesQuranWordSequence(printed, expected, complete) {
  const maxGroup = 4;
  const printedForms = makeWordForms(printed, maxGroup);
  const expectedForms = makeWordForms(expected, maxGroup);
  const reachable = Array.from({ length: printed.length + 1 }, () => Array(expected.length + 1).fill(false));
  if (complete) reachable[0][0] = true;
  else reachable[0].fill(true);
  for (let printedIndex = 0; printedIndex < printed.length; printedIndex += 1) {
    for (let expectedIndex = 0; expectedIndex < expected.length; expectedIndex += 1) {
      if (!reachable[printedIndex][expectedIndex]) continue;
      for (const [printedLength, printedVariants] of printedForms[printedIndex]) {
        for (const [expectedLength, expectedVariants] of expectedForms[expectedIndex]) {
          if (formsIntersect(printedVariants, expectedVariants)) reachable[printedIndex + printedLength][expectedIndex + expectedLength] = true;
        }
      }
    }
  }
  return complete ? reachable[printed.length][expected.length] : reachable[printed.length].some(Boolean);
}

function validate(page) {
  const wordsByAyah = new Map();
  const completed = new Set();
  let checked = 0;
  const issues = [];
  for (const line of page.lines) {
    for (const word of line.words) {
      if (word.type === "bismillah") {
        if (!matchesQuranWordSequence(tokens(word.text ?? ""), expected.get("1:1") ?? [], true)) {
          issues.push("bismillah text mismatch");
        }
        continue;
      }
      if (!word.verse_key) continue;
      const expectedWords = expected.get(word.verse_key);
      if (!expectedWords) { issues.push(`unexpected verse ${word.verse_key}`); continue; }
      if (word.type === "end") { completed.add(word.verse_key); continue; }
      if (word.type !== "word") continue;
      if (!word.text || !Number.isInteger(word.position) || word.position < 1) { issues.push(`missing position ${word.verse_key}`); continue; }
      if (word.text === "#1969" && word.position === expectedWords.length + 1 && ayat.get(word.verse_key)?.includes("\u06E9")) continue;
      const printed = tokens(word.text);
      if (printed.length !== 1) {
        issues.push({ key: word.verse_key, position: word.position, qcf: word.text, local: ayat.get(word.verse_key) });
        continue;
      }
      wordsByAyah.set(word.verse_key, [...(wordsByAyah.get(word.verse_key) ?? []), { position: word.position, text: printed[0] }]);
      checked += 1;
    }
  }
  for (const [key, words] of wordsByAyah) {
    const positions = words.map(word => word.position);
    if (positions.some((position, index) => index > 0 && position !== positions[index - 1] + 1)) issues.push(`verse word positions are discontinuous ${key}`);
    const expectedWords = expected.get(key) ?? [];
    if (!matchesQuranWordSequence(words.map(word => word.text), expectedWords, completed.has(key))) {
      issues.push({ key, qcf: words.map(word => word.text), local: ayat.get(key), complete: completed.has(key) });
    }
  }
  if (checked < 8) issues.push(`too few verified words (${checked})`);
  return issues.length ? issues : null;
}

async function fetchPage(page, base) {
  const filename = String(page).padStart(3, "0");
  const response = await fetch(`${base}/pages/${filename}.json`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.page !== page || !Array.isArray(data.lines) || !data.lines.length) throw new Error("invalid page shape");
  const lineNumbers = new Set();
  for (const line of data.lines) {
    if (!Number.isInteger(line.line) || line.line < 1 || line.line > 15 || lineNumbers.has(line.line)
      || !Array.isArray(line.words) || !line.words.length
      || line.words.some(word => !Number.isInteger(word.code) || word.code < 0 || word.code > 0x10ffff || !/^QCF4_(?:Hafs_\d{2}|QBSML)$/.test(word.font))) {
      throw new Error("invalid glyph data");
    }
    lineNumbers.add(line.line);
  }
  return data;
}

const requestedPages = process.argv.slice(2).map(Number).filter(page => Number.isInteger(page) && page >= 1 && page <= totalPages);
const pagesToCheck = requestedPages.length ? requestedPages : Array.from({ length: totalPages }, (_, i) => i + 1);
const failures = [];
let completed = 0;
let cursor = 0;
const workers = Array.from({ length: 8 }, async () => {
  while (true) {
    const index = cursor++;
    if (index >= pagesToCheck.length) return;
    const page = pagesToCheck[index];
    let result;
    const errors = [];
    for (const base of bases) {
      try {
        const data = await fetchPage(page, base);
        const issue = validate(data);
        if (!issue) { result = "ok"; break; }
        errors.push(issue);
      } catch (error) { errors.push(error.message); }
    }
    if (result !== "ok") failures.push({ page, errors: errors[0] });
    completed += 1;
    if (completed % 50 === 0 || completed === totalPages) console.log(`Checked ${completed}/${totalPages}`);
  }
});
await Promise.all(workers);
failures.sort((a, b) => a.page - b.page);
const issueGroups = new Map();
for (const failure of failures) {
  const issue = Array.isArray(failure.errors) ? failure.errors[0] : failure.errors;
  const label = typeof issue === "string" ? issue.split(":")[0] : issue?.qcf?.startsWith("#") ? `special marker ${issue.qcf}` : issue?.qcf ? `word mismatch: ${issue.qcf}` : "other";
  issueGroups.set(label, (issueGroups.get(label) ?? 0) + 1);
}
console.log(JSON.stringify({
  pageCount: pagesToCheck.length,
  valid: pagesToCheck.length - failures.length,
  failedPages: failures.map(({ page }) => page),
  issueGroups: Object.fromEntries(issueGroups),
  details: failures.map(({ page, errors }) => ({ page, issues: Array.isArray(errors) ? errors.slice(0, 3) : errors })),
}, null, 2));
if (failures.length) process.exitCode = 1;
