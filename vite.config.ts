import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin, type UserConfig, type ViteDevServer } from "vite";
import { publicPlatformScript } from "./server/_core/publicConfig";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

// Static development and static publishing use the same public-value whitelist
// as Express. Runtime-only secrets never enter the browser bundle. Express keeps
// serving this path dynamically when the application server is selected.
function vitePluginPublicPlatformConfig(): Plugin {
  return {
    name: "manus-public-platform-config",
    configureServer(server) {
      server.middlewares.use("/api/platform/config.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.end(publicPlatformScript());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "api/platform/config.js", source: publicPlatformScript() });
    },
  };
}

// Keep temporary source archives and the retired 3D Mushaf preview out of both
// Vite's dev server and production assets. Public assets are emitted explicitly
// so these internal/unused files are excluded without moving project files.
function vitePluginCuratedPublicAssets(): Plugin {
  const publicDir = path.join(PROJECT_ROOT, "client", "public");
  const excludedPaths = ["data/quran/_kfgqpc_v2_work", "models/quran"];
  const excludedUrls = excludedPaths.map(value => `/${value}`);

  const blockPrivateUrl = (req: { url?: string }, res: { statusCode: number; end: () => void }, next: () => void) => {
    const pathname = (req.url ?? "").split("?", 1)[0];
    if (excludedUrls.some(url => pathname === url || pathname.startsWith(`${url}/`))) {
      res.statusCode = 404;
      res.end();
      return;
    }
    next();
  };

  return {
    name: "meethaq-curated-public-assets",
    configureServer(server) {
      server.middlewares.use(blockPrivateUrl);
    },
    configurePreviewServer(server) {
      server.middlewares.use(blockPrivateUrl);
    },
    generateBundle() {
      const emitDirectory = (directory: string, relativeDirectory = "") => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const relativePath = path.posix.join(relativeDirectory, entry.name);
          if (relativePath === "service-worker.js" || excludedPaths.some(excluded => relativePath === excluded || relativePath.startsWith(`${excluded}/`))) continue;
          const absolutePath = path.join(directory, entry.name);
          if (entry.isDirectory()) emitDirectory(absolutePath, relativePath);
          else if (entry.isFile()) this.emitFile({ type: "asset", fileName: relativePath, source: fs.readFileSync(absolutePath) });
        }
      };
      emitDirectory(publicDir);
    },
  };
}

function vitePluginOfflineShell(): Plugin {
  return {
    name: "meethaq-offline-shell",
    apply: "build",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const source = fs.readFileSync(path.join(PROJECT_ROOT, "client/public/service-worker.js"), "utf8");
        const filenames = [
          "index.html",
          "theme-init.js",
          "manifest.webmanifest",
          "brand.svg",
          "brand-512.png",
          "adhan.mp3",
          "images/meethaq-dawn-hero.jpg",
          "images/meethaq-journey.jpg",
          "images/meethaq-dusk.jpg",
          "images/meethaq-ward.jpg",
          "images/meethaq-courtyard.jpg",
          "images/meethaq-arcade.jpg",
          "images/meethaq-mushaf-real.jpg",
          "images/mushaf-page-border.svg",
          "images/mushaf-qcf-banner.png",
          "images/reference-refraction.png",
          "data/quran/quran-hafs.tsv",
          "data/quran/print-be0091b2/001.webp",
          "data/quran/print-be0091b2/002.webp",
          "data/quran/print-be0091b2/ayah-regions.json",
          "fonts/kfgqpc-hafs-uthmanic-script.ttf",
          "fonts/ArefRuqaa-Regular.ttf",
          "fonts/ArefRuqaa-Bold.ttf",
          "fonts/Cairo-Variable.ttf",
          "fonts/Amiri-Regular.ttf",
          "fonts/Amiri-Bold.ttf",
          "fonts/NotoNaskhArabic-Variable.ttf",
          "fonts/ReemKufi-Variable.ttf",
          ...Object.keys(bundle).filter(name => name.startsWith("assets/")).sort(),
        ];
        const hash = createHash("sha256").update(source);
        for (const filename of filenames) {
          const file = bundle[filename];
          if (!file) this.error(`Missing offline asset: ${filename}`);
          hash.update(filename).update(file.type === "chunk" ? file.code : file.source);
        }
        const precache = {
          version: hash.digest("hex").slice(0, 16),
          urls: filenames.map(filename => filename === "index.html" ? "/" : `/${filename}`),
        };
        this.emitFile({
          type: "asset",
          fileName: "service-worker.js",
          source: source.replace("/* build:precache */ { version: \"dev\", urls: [] }", JSON.stringify(precache)),
        });
      },
    },
  };
}

const plugins = [
  vitePluginCuratedPublicAssets(),
  vitePluginPublicPlatformConfig(),
  vitePluginOfflineShell(),
  react(),
  tailwindcss(),
];

export const viteConfig: UserConfig = {
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: {
      output: {
        // Keep the main dependency groups cacheable across deploys.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
          if (/@trpc|@tanstack|superjson/.test(id)) return "data";
          if (/lucide-react/.test(id)) return "icons";
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
};

export default defineConfig(({ mode }) => {
  const port = Number(loadEnv(mode, PROJECT_ROOT, "PORT").PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  return { ...viteConfig, server: { ...viteConfig.server, port } };
});
