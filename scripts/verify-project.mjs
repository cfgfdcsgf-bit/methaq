import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const checks = [];
const check = (name, ok, detail = "") => { checks.push({ name, ok, detail }); if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ""}`); };
const file = name => resolve(root, name);

for (const required of ["package.json", "drizzle/schema.ts", "server/routers.ts", "client/src/App.tsx", "client/public/manifest.webmanifest", "client/public/data/quran/quran-hafs.tsv"]) {
  check(`وجود ${required}`, existsSync(file(required)));
}

const quranPath = file("client/public/data/quran/quran-hafs.tsv");
const printPages = Array.from({ length: 604 }, (_, index) =>
  `data/quran/print-be0091b2/${String(index + 1).padStart(3, "0")}.webp`);
const printRegionsPath = "data/quran/print-be0091b2/ayah-regions.json";
check("النسخة المطبوعة تشمل جميع صفحات المصحف", printPages.every(page =>
  existsSync(file(`client/public/${page}`)) && statSync(file(`client/public/${page}`)).size > 0));
if (existsSync(quranPath)) {
  const lines = readFileSync(quranPath, "utf8").split(/\r?\n/).filter(Boolean);
  const rows = lines.filter(line => !line.startsWith("id\t"));
  const surahs = new Set();
  const pages = new Set();
  const verseIdsByPage = Array.from({ length: 604 }, () => []);
  let sequential = true;
  rows.forEach((line, index) => {
    const columns = line.split("\t");
    const global = Number(columns[0]);
    const page = Number(columns[2]);
    const surah = Number(columns[3]);
    const ayah = Number(columns[8]);
    surahs.add(surah); pages.add(page);
    if (verseIdsByPage[page - 1]) verseIdsByPage[page - 1].push(global);
    if (global !== index + 1 || !Number.isInteger(ayah) || ayah < 1) sequential = false;
  });
  check("سلامة عدد آيات المصحف", rows.length === 6236, `${rows.length} بدل 6236`);
  check("سلامة عدد السور", surahs.size === 114, `${surahs.size} بدل 114`);
  check("سلامة عدد الصفحات", pages.size === 604, `${pages.size} بدل 604`);
  check("تسلسل أرقام الآيات العام", sequential);
  const printRegions = JSON.parse(readFileSync(file(`client/public/${printRegionsPath}`), "utf8"));
  check("مناطق الضغط تطابق جميع آيات صفحات الطبعة", printRegions.length === verseIdsByPage.length &&
    printRegions.every((entries, page) => entries.length === verseIdsByPage[page].length &&
      entries.every(([id, boxes], i) => id === verseIdsByPage[page][i] && boxes.length && boxes.every(box =>
        box.length === 4 && box.every(value => Number.isInteger(value) && value >= 0 && value <= 10000) &&
        box[0] < box[2] && box[1] < box[3]))));
}

const routeManifest = JSON.parse(readFileSync(file("client/public/manus-routes.json"), "utf8"));
const manifestPaths = new Set(routeManifest.routes.map(route => route.path));
const routeSources = [
  [readFileSync(file("client/src/pages/Home.tsx"), "utf8"), /^  "(\/[^"]*)": [A-Z][\w]+,$/gm],
  [readFileSync(file("client/src/components/Explore.tsx"), "utf8"), /path: "(\/[^"]+)"/g],
  [readFileSync(file("client/src/components/ContentPage.tsx"), "utf8"), /path: "(\/[^"]+)"/g],
];
const configuredRoutes = new Set(["/explore", "/verify-email", "/reset-password", "/404", ...routeSources.flatMap(([source, matcher]) => [...source.matchAll(matcher)].map(match => match[1]))]);
check("كتالوج المسارات يطابق وجهات التطبيق", configuredRoutes.size === manifestPaths.size && [...configuredRoutes].every(path => manifestPaths.has(path)));

const journal = JSON.parse(readFileSync(file("drizzle/meta/_journal.json"), "utf8"));
const migrations = journal.entries.map(({ tag }) => `drizzle/${tag}.sql`);
check("هجرة materials موجودة", migrations.some(name => existsSync(file(name)) && readFileSync(file(name), "utf8").includes('CREATE TABLE "materials"')));
check("هجرة passwordHash موجودة", migrations.some(name => existsSync(file(name)) && readFileSync(file(name), "utf8").includes('passwordHash')));
check("هجرة emailVerified موجودة", migrations.some(name => existsSync(file(name)) && readFileSync(file(name), "utf8").includes('emailVerified')));
const migrationSource = migrations.map(name => readFileSync(file(name), "utf8")).join("\n");
check("جداول الحساب والمحتوى والتنبيهات مدرجة في الترحيلات", ["auth_tokens", "user_progress", "rafiq_usage", "material_audit", "material_reports", "push_devices"].every(table => migrationSource.includes(`CREATE TABLE "${table}"`)));

const packageJson = JSON.parse(readFileSync(file("package.json"), "utf8"));
for (const script of ["check", "test", "build", "db:push"]) check(`أمر ${script} معرف`, Boolean(packageJson.scripts?.[script]));

const indexHtml = readFileSync(file("client/index.html"), "utf8");
const viteSource = readFileSync(file("vite.config.ts"), "utf8");
const serverSource = readFileSync(file("server/_core/index.ts"), "utf8");
check("تهيئة السمة بملف محلي مسموح في CSP", indexHtml.includes('<script src="/theme-init.js"></script>') && existsSync(file("client/public/theme-init.js")));
check("تهيئة السمة مدرجة في precache", viteSource.includes('"theme-init.js"'));
const fonts = ["Cairo-Variable.ttf", "Amiri-Regular.ttf", "Amiri-Bold.ttf", "NotoNaskhArabic-Variable.ttf", "ReemKufi-Variable.ttf"];
check("CSP يحصر scripts في المصدر نفسه", serverSource.includes('"script-src \'self\'"'));
check("خطوط الواجهة محلية ومشمولة في precache", fonts.every(font => existsSync(file("client/public/fonts/" + font)) && viteSource.includes("fonts/" + font))
  && !readFileSync(file("client/src/index.css"), "utf8").includes("fonts.googleapis.com"));

if (process.argv.includes("--build")) {
  const built = name => file(`dist/public/${name}`);
  const html = readFileSync(built("index.html"), "utf8");
  const worker = readFileSync(built("service-worker.js"), "utf8");
  const manifest = worker.match(/^const PRECACHE = (\{.*\});$/m)?.[1];
  const precache = manifest ? JSON.parse(manifest) : { version: "", urls: [] };
  const urls = new Set(precache.urls);
  const entryAssets = Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g), match => match[1]);
  check("ذاكرة العمل دون اتصال مرتبطة بنسخة البناء", /^[a-f0-9]{16}$/.test(precache.version));
  check("ذاكرة العمل دون اتصال تشمل ملفات بدء الواجهة", entryAssets.length > 0 && entryAssets.every(asset => urls.has(asset)));
  check("ذاكرة العمل دون اتصال تشمل الصفحة ونص المصحف المحلي", ["/", "/data/quran/quran-hafs.tsv"].every(url => urls.has(url)));
  check("بناء الواجهة يضم صفحات الطبعة كاملة", printPages.every(page => existsSync(built(page))));
  check("صفحـتا افتتاح المصحف متاحتان دون اتصال", printPages.slice(0, 2).every(page => urls.has("/" + page)));
  check("مناطق اختيار الآيات متاحة دون اتصال", urls.has("/" + printRegionsPath) && existsSync(built(printRegionsPath)));
  check("ملفات ذاكرة العمل دون اتصال موجودة في البناء", urls.size > 0 && [...urls].every(url => existsSync(built(url === "/" ? "index.html" : url.slice(1)))));
}

console.log(checks.map(item => `${item.ok ? "PASS" : "FAIL"} ${item.name}${item.detail ? ` — ${item.detail}` : ""}`).join("\n"));
if (failures.length) { console.error(`\n${failures.length} فحوص فشلت.`); process.exitCode = 1; } else console.log("\nكل الفحوص المستقلة نجحت.");
