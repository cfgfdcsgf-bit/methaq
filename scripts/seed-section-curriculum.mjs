import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { curriculum } from "./section-curriculum.mjs";

const adhkar = [
  ["أذكار الصباح والمساء", "سيد الاستغفار", "سيد الاستغفار"],
  ["أذكار الصباح والمساء", "بسم الله الذي لا يضر مع اسمه شيء", "من قال بسم الله الذي لا يضر مع اسمه"],
  ["أذكار الصباح والمساء", "ذكر المساء والصباح: أمسينا وأمسى الملك لله", "كان نبي الله صلى الله عليه وسلم إذا أمسى قال"],
  ["أذكار النوم", "ذكر عند الاضطجاع: باسمك ربي وضعت جنبي", "إذا أوى أحدكم إلى فراشه فلينفض فراشه"],
  ["أذكار النوم", "الإخلاص والمعوذتان عند النوم", "أن النبي صلى الله عليه وسلم كان إذا أوى إلى فراشه كل ليلة جمع كفيه"],
  ["أذكار بعد الصلاة", "التهليل بعد الصلاة", "كان رسول الله صلى الله عليه وسلم يهلل بهن دبر كل صلاة"],
  ["أذكار بعد الصلاة", "قراءة المعوذات بعد الصلاة", "أمرني رسول الله صلى الله عليه وسلم أن أقرأ بالمعوذات دبر كل صلاة"],
  ["أذكار المنزل", "ذكر الخروج من المنزل", "من قال -يعني: إذا خرج من بيته-"],
  ["أدعية مأثورة", "دعاء الاستخارة عند التردد في أمر", "كان رسول الله صلى الله عليه وسلم يعلمنا الاستخارة في الأمور"],
  ["أدعية مأثورة", "الاستعاذة في السفر", "كان رسول الله صلى الله عليه وسلم إذا سافر يتعوذ من وعثاء السفر"],
  ["أدعية مأثورة", "دعاء الشفاء للمريض", "اللهم رب الناس مذهب البأس"],
  ["أدعية مأثورة", "دعاء الكرب", "أن نبي الله صلى الله عليه وسلم كان يقول عند الكرب"],
  ["أدعية مأثورة", "الحمد بعد الطعام", "من أكل طعاما فقال: الحمد لله الذي أطعمني"],
];

const passages = [
  ["آية الكرسي", "البقرة ٢٥٥", 2, 255, 255],
  ["خواتيم سورة البقرة", "البقرة ٢٨٥–٢٨٦", 2, 285, 286],
  ["سورة الإخلاص", "الإخلاص", 112, 1, 4],
  ["سورة الفلق", "الفلق", 113, 1, 5],
  ["سورة الناس", "الناس", 114, 1, 6],
];

const normalize = text => text.normalize("NFC").replace(/[\p{M}ـ]/gu, "").replace(/\s+/g, " ").trim();
const identity = row => JSON.stringify([row.kind, row.category, row.title]);
const apply = process.argv.includes("--apply");

async function quranMaterials() {
  const path = new URL("../client/public/data/quran/quran-hafs.tsv", import.meta.url);
  const rows = (await readFile(path, "utf8")).split(/\r?\n/).map(line => line.split("\t"));
  return passages.map(([title, reference, surah, first, last]) => {
    const verses = rows.filter(row => Number(row[3]) === surah && Number(row[8]) >= first && Number(row[8]) <= last);
    if (verses.length !== last - first + 1) throw new Error("Incomplete Quran passage: " + title);
    const body = verses.map(row => row[9].replace(/^\uFEFF|[\uE000-\uF8FF\uFC00-\uFDFF]+$/gu, "").trim()).join("\n");
    return { kind: "adhkar", category: "أذكار قرآنية", title, source: "مصحف حفص (مجمع الملك فهد) — " + reference, body, grade: "قرآن كريم" };
  });
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  if (apply) await client.query("select pg_advisory_xact_lock(279014031)");
  const { rows: hadith } = await client.query(
    "select title, body, source, grade from materials where kind = 'sunnah' and status = 'published' " +
    "and source like 'موسوعة الأحاديث النبوية%' and grade in ('صحيح', 'حسن') order by id"
  );
  const hadithByTitle = hadith.map(row => ({ ...row, normalizedTitle: normalize(row.title) }));
  const selected = adhkar.map(([category, title, prefix]) => {
    const match = hadithByTitle.find(row => row.normalizedTitle.startsWith(normalize(prefix)));
    if (!match?.body || !/^المتن:\s*\S/u.test(match.body)) throw new Error("Published hadith not found: " + title);
    return { kind: "adhkar", category, title, body: match.body, source: match.source + " — " + match.title, grade: match.grade };
  });
  const materials = [...curriculum, ...selected, ...await quranMaterials()];
  const keys = new Set();
  for (const row of materials) {
    const key = identity(row);
    // The original hadith title remains available in the source corpus.
    row.source = row.source.slice(0, 255);
    if (keys.has(key) || !row.title.trim() || row.title.length > 255 || !row.category.trim() || row.category.length > 120
      || !row.source.trim() || !row.body.trim() || row.body.length > 60000) throw new Error("Invalid section material: " + row.title);
    keys.add(key);
  }

  const { rows: existing } = await client.query("select kind, category, title, status from materials where kind in ('library', 'learning', 'adhkar')");
  const existingKeys = new Set(existing.map(identity));
  const fresh = materials.filter(row => !existingKeys.has(identity(row)));
  const matchesInReview = existing.filter(row => keys.has(identity(row)) && row.status !== "published");
  if (matchesInReview.length) throw new Error("Matching draft or review entry: " + matchesInReview.map(row => row.title).join("، "));
  if (apply && fresh.length) {
    const { rows: imported } = await client.query(
      "insert into materials (kind, category, title, body, source, grade, status) " +
      "select data.kind::material_kind, data.category, data.title, data.body, data.source, data.grade, 'review' " +
      "from jsonb_to_recordset($1::jsonb) as data(kind text, category text, title text, body text, source text, grade text) returning id",
      [JSON.stringify(fresh)]
    );
    const published = await client.query(
      "update materials set status = 'published' where id = any($1::int[]) and status = 'review' returning id",
      [imported.map(row => row.id)]
    );
    if (published.rowCount !== fresh.length) throw new Error("Incomplete section publication");
  }
  await client.query("commit");
  const bySection = {};
  for (const row of materials) {
    const key = row.kind + "/" + row.category;
    bySection[key] = (bySection[key] ?? 0) + 1;
  }
  console.log(JSON.stringify({ mode: apply ? "applied" : "dry run", prepared: materials.length, fresh: fresh.length, bySection }, null, 2));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
