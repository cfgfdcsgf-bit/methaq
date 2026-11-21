import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const client = new Client({ connectionString });
try {
  await client.connect();
  const { rows } = await client.query(`
    select kind, status, count(*)::int as count
    from materials
    group by kind, status
    order by kind, status
  `);
  const { rows: totals } = await client.query(`
    select count(*)::int as total,
      count(*) filter (where status = 'published')::int as published,
      count(*) filter (where status = 'review')::int as review,
      count(*) filter (where status = 'draft')::int as draft
    from materials
  `);
  console.log("Content inventory");
  console.log(JSON.stringify({ totals: totals[0], byKind: rows }, null, 2));
} finally {
  await client.end().catch(() => undefined);
}
