import "dotenv/config";
import pg from "pg";

const CSV_URL = "https://hadeethenc.com/ar/browse/download/ar/csv";
const API = "https://hadeethenc.com/api/v1/";
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
  return rows.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])));
}

async function download(url) {
  const reply = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!reply.ok) throw new Error("HadeethEnc returned HTTP " + reply.status);
  return reply;
}

async function sourceTopics() {
  const categories = await (await download(API + "categories/list/?language=ar")).json();
  const roots = categories.filter(category => !category.parent_id && Number(category.hadeeths_count) > 0);
  if (!roots.length) throw new Error("The source did not return its top-level categories");
  const entriesByRoot = await Promise.all(roots.map(async category => {
    const entries = [];
    for (let page = 1; page <= 100; page++) {
      const result = await (await download(API + "hadeeths/list/?language=ar&per_page=100&category_id=" + encodeURIComponent(category.id) + "&page=" + page)).json();
      if (!Array.isArray(result.data)) throw new Error("Unexpected HadeethEnc category listing");
      entries.push(...result.data.map(item => [String(item.id), category.title]));
      if (!result.data.length || page >= Number(result.meta?.last_page)) break;
      if (page === 100) throw new Error("HadeethEnc listing exceeded the page limit");
    }
    return entries;
  }));
  const topics = new Map();
  for (const [id, topic] of entriesByRoot.flat()) {
    if (!topics.has(id)) topics.set(id, topic);
  }
  if (!topics.size) throw new Error("No verified topic assignments returned");
  return topics;
}

function sourceRecord(row, topic) {
  return {
    id: "hadeethenc:" + row.id,
    title: row.title.slice(0, 255),
    category: topic?.slice(0, 120) ?? "حديث موثق",
    body: [
      "المتن:\n" + row.hadith_text,
      row.explanation && "الشرح:\n" + row.explanation,
      row.word_meanings && "معاني الكلمات:\n" + row.word_meanings,
      row.benefits && "الفوائد:\n" + row.benefits,
    ].filter(Boolean).join("\n\n"),
    source: ("موسوعة الأحاديث النبوية — " + (row.takhrij || "التخريج في المصدر الأصلي")).slice(0, 255),
    grade: (row.grade || "بحاجة لمراجعة الدرجة").slice(0, 120),
  };
}

const fingerprint = ({ title, body }) => JSON.stringify([title.trim(), body.replace(/\r\n/g, "\n")
  .replace(/\s*الرابط الأصلي:\s*https:\/\/hadeethenc\.com\/ar\/browse\/hadith\/\d+\/?\s*$/u, "").trim()]);

const args = process.argv.slice(2);
const limit = Number(args.find(arg => arg.startsWith("--limit="))?.slice(8) ?? Infinity);
if (!(limit === Infinity || (Number.isSafeInteger(limit) && limit > 0))) throw new Error("Use a positive --limit");
const [response, topics] = await Promise.all([download(CSV_URL), sourceTopics()]);
const allRecords = parseCsv(await response.text()).filter(row => /^\d+$/.test(row.id) && row.hadith_text && row.link)
  .map(row => sourceRecord(row, topics.get(row.id)));
const records = allRecords.slice(0, limit);
const catalog = { downloaded: records.length, withTopic: records.filter(row => row.category !== "حديث موثق").length };
if (args.includes("--catalog-only")) {
  console.log(JSON.stringify(catalog));
} else {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(80421733)");
    const existing = await client.query("select id, title, category, body, source, \"externalId\" from materials where kind = 'sunnah' order by id");
    const linked = new Map(existing.rows.filter(row => row.externalId).map(row => [row.externalId, row]));
    const fingerprints = new Map(allRecords.map(row => [fingerprint(row), row.id]));
    const titles = new Map();
    for (const row of allRecords) {
      const key = row.title.trim();
      titles.set(key, titles.has(key) ? null : row.id);
    }
    const legacy = new Map();
    for (const row of existing.rows) {
      if (row.externalId || !row.source?.startsWith("موسوعة الأحاديث النبوية")) continue;
      const link = row.body.match(/https:\/\/hadeethenc\.com\/ar\/browse\/hadith\/(\d+)/u);
      const id = link ? "hadeethenc:" + link[1] : fingerprints.get(fingerprint(row)) ?? titles.get(row.title.trim());
      if (!id) throw new Error("Legacy source row " + row.id + " needs its official identifier before import. No records were changed.");
      if (!legacy.has(id)) legacy.set(id, row);
    }
    let adopted = 0, categorized = 0;
    const updates = [];
    const newRows = [];
    for (const row of records) {
      const old = linked.get(row.id) ?? legacy.get(row.id);
      if (old) {
        const category = !old.category || old.category === "حديث موثق" ? row.category : old.category;
        if (old.externalId !== row.id || category !== old.category) {
          updates.push({ id: old.id, external_id: row.id, category });
          if (!old.externalId) adopted++;
          if (category !== old.category) categorized++;
        }
        continue;
      }
      newRows.push(row);
    }
    if (args.includes("--backfill-only") && newRows.length > 0) {
      throw new Error("Backfill would insert " + newRows.length + " unmatched records. All changes were rolled back.");
    }
    for (let offset = 0; offset < updates.length; offset += 250) {
      await client.query(`update materials as material set "externalId"=next.external_id,
          category=case when material.category is null or material.category='حديث موثق' then next.category else material.category end
        from jsonb_to_recordset($1::jsonb) as next(id integer, external_id text, category text)
        where material.id = next.id and (material."externalId" is null or material."externalId" = next.external_id)`,
      [JSON.stringify(updates.slice(offset, offset + 250))]);
    }
    let inserted = 0;
    for (let offset = 0; offset < newRows.length; offset += 100) {
      const result = await client.query(`insert into materials (kind,title,category,body,source,grade,status,"externalId")
        select 'sunnah', title, category, body, source, grade, 'review', id
        from jsonb_to_recordset($1::jsonb) as next(id text, title text, category text, body text, source text, grade text)
        on conflict ("externalId") where "externalId" is not null do nothing`, [JSON.stringify(newRows.slice(offset, offset + 100))]);
      inserted += result.rowCount;
    }
    await client.query(args.includes("--dry-run") ? "rollback" : "commit");
    console.log(JSON.stringify({ ...catalog, inserted, adopted, categorized, dryRun: args.includes("--dry-run") }));
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally { await client.end(); }
}
