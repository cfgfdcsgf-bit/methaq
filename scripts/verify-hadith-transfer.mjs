import "dotenv/config";
import { createHash } from "node:crypto";
import pg from "pg";

const CSV_URL = "https://hadeethenc.com/ar/browse/download/ar/csv";
const { Client } = pg;

function parseCsv(text) {
  const headerStart = text.indexOf("id,title,hadith_text");
  if (headerStart < 0) throw new Error("CSV header was not found");
  text = text.slice(headerStart);
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift().map(header => header.trim());
  return rows.filter(record => record.some(Boolean)).map(record => Object.fromEntries(headers.map((header, i) => [header, record[i] ?? ""])));
}

function expectedRecord(row) {
  const body = [`المتن:\n${row.hadith_text}`, row.explanation ? `الشرح:\n${row.explanation}` : "", row.word_meanings ? `معاني الكلمات:\n${row.word_meanings}` : "", row.benefits ? `الفوائد:\n${row.benefits}` : ""].filter(Boolean).join("\n\n");
  return {
    kind: "sunnah",
    externalId: "hadeethenc:" + row.id,
    title: row.title.slice(0, 255),
    body,
    source: `موسوعة الأحاديث النبوية — ${row.takhrij || "التخريج في الرابط الأصلي"}`.slice(0, 255),
    grade: (row.grade || "بحاجة لمراجعة الدرجة").slice(0, 120),
  };
}

function fingerprint(record) {
  const body = record.body.replace(/\r\n/g, "\n")
    .replace(/\s*الرابط الأصلي:\s*https:\/\/hadeethenc\.com\/ar\/browse\/hadith\/\d+\/?\s*$/u, "").trim();
  const source = record.source?.replace("التخريج في المصدر الأصلي", "التخريج في الرابط الأصلي");
  return createHash("sha256").update(JSON.stringify([record.kind, record.externalId, record.title, body, source, record.grade])).digest("hex");
}

function multiset(records) {
  const counts = new Map();
  for (const record of records) {
    const key = fingerprint(record);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const response = await fetch(CSV_URL);
if (!response.ok) throw new Error(`Failed to download source CSV: ${response.status}`);
const sourceRows = parseCsv(await response.text()).filter(row => row.id && row.hadith_text && row.link);
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const result = await client.query(`select kind, title, body, source, grade, "externalId" from materials where kind = 'sunnah' and ("externalId" like 'hadeethenc:%' or source like 'موسوعة الأحاديث النبوية%')`);
  const expected = multiset(sourceRows.map(expectedRecord));
  const actual = multiset(result.rows);
  let matched = 0, missing = 0, extra = 0;
  for (const [key, count] of expected) {
    const same = Math.min(count, actual.get(key) ?? 0);
    matched += same;
    missing += count - same;
  }
  for (const [key, count] of actual) extra += Math.max(0, count - (expected.get(key) ?? 0));
  const report = { sourceRecords: sourceRows.length, databaseRecords: result.rows.length, matched, missing, extra, transferIntegrity: missing === 0 && extra === 0 ? "PASS" : "FAIL", note: "Compares official IDs and text metadata independently of topic and publication status." };
  console.log(JSON.stringify(report, null, 2));
  if (report.transferIntegrity !== "PASS") process.exitCode = 1;
} finally {
  await client.end();
}
