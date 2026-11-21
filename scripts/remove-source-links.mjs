import "dotenv/config";
import pg from "pg";

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const result = await client.query(`
    update materials
    set body = regexp_replace(body, E'\\n*الرابط الأصلي:.*$', '')
    where kind = 'sunnah' and body like '%الرابط الأصلي:%'
  `);
  console.log(JSON.stringify({ cleaned: result.rowCount }, null, 2));
} finally {
  await client.end();
}
