import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Hashed build files never change, so browsers may keep them for a year; HTML and the service worker must always revalidate.
  app.use(express.static(distPath, {
    setHeaders(res, filePath) {
      const normalized = filePath.replace(/\\/g, "/");
      if (/\/assets\//.test(normalized)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      else if (/\/data\/quran\/print-/.test(normalized) || /\/(images|fonts)\//.test(normalized)) res.setHeader("Cache-Control", "public, max-age=2592000");
      else if (/\.(html|webmanifest)$|service-worker\.js$/.test(normalized)) res.setHeader("Cache-Control", "no-cache");
    },
  }));

  // the app's not-found page keeps a real 404 status for crawlers
  app.get("/404", (_req, res) => {
    res.status(404).sendFile(path.resolve(distPath, "index.html"));
  });

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
