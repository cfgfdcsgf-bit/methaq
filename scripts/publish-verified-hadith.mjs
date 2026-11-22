import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const apply = process.argv.includes("--apply");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const filter = `kind = 'sunnah' and status = 'review' and source like 'موسوعة الأحاديث النبوية%' and grade in ('صحيح', 'حسن')`;
  const count = await client.query(`select count(*)::int as count from materials where ${filter}`);
  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", eligible: count.rows[0].count, rule: "grade is exactly صحيح or حسن; source is HadeethEnc; status is review" }, null, 2));
    console.log("Nothing changed. Add --apply to publish the eligible materials.");
  } else {
    const result = await client.query(`update materials set status = 'published', "updatedAt" = now() where ${filter}`);
    console.log(JSON.stringify({ mode: "apply", published: result.rowCount, rule: "grade is exactly صحيح or حسن; source is HadeethEnc" }, null, 2));
  }
} finally {
  await client.end();
}
