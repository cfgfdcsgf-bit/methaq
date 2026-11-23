import "dotenv/config";
import express from "express";
import compression from "compression";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { ENV } from "./env";
import { registerGoogleAuthRoutes } from "./googleAuth";
import { publicPlatformScript } from "./publicConfig";
import { registerWebPush } from "./webPush";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./static";
import { dbHealthy } from "../db";
import { mailAvailable } from "./mailer";

// Production only: the Vite dev server needs inline scripts and websockets that this policy would block.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data: https://cdn.jsdelivr.net https://raw.githubusercontent.com",
  "connect-src 'self' https:",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

async function startServer() {
  if (ENV.isProduction && !ENV.cookieSecret) {
    throw new Error("MEETHAQ_SESSION_SECRET is required in production. Set a long random value in the host's environment variables.");
  }
  if (!ENV.ownerEmail) console.warn("[Auth] OWNER_EMAIL is not set: no account can become the site owner until you set it in .env.");
  if (!mailAvailable()) console.warn("[Mail] BREVO_API_KEY (or RESEND_API_KEY), MAIL_FROM and APP_URL are not all set: email verification and password reset are switched off.");
  const app = express();
  app.disable("x-powered-by");
  // Behind a hosting reverse proxy, req.ip must be the visitor (not the proxy) or all visitors share one login rate limit.
  const trustProxy = process.env.TRUST_PROXY ?? (ENV.isProduction ? "1" : "0");
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  const server = createServer(app);

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Permissions-Policy", "geolocation=(self), camera=(), microphone=(), payment=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    if (ENV.isProduction) {
      res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
      if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    next();
  });

  app.use(compression());
  // Only the routes that really take a body get a large limit: the admin import (500 items) needs a few MB.
  app.use("/api/trpc", express.json({ limit: "5mb" }));
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ limit: "100kb", extended: true }));
  app.get("/api/health", async (_req, res) => {
    const database = await dbHealthy();
    res.set("Cache-Control", "no-store").status(database ? 200 : 503).json({ status: database ? "ok" : "degraded", database });
  });
  app.get("/api/rafiq/status", (_req, res) => {
    const manusReady = Boolean(ENV.forgeApiUrl.trim() && ENV.forgeApiKey);
    const openAiReady = Boolean(ENV.openaiApiKey && ENV.openaiModel);
    res.set("Cache-Control", "no-store").json({ enabled: manusReady || openAiReady });
  });
  app.get("/api/auth/features", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ email: mailAvailable() });
  });
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  registerWebPush(app);
  // The legacy Manus OAuth callback is no longer registered: sign-in is local email/password or Google.
  registerGoogleAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // An unknown API path is a real 404, not the single-page app's HTML.
  app.use("/api", (_req, res) => { res.status(404).json({ error: "not_found" }); });
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log("Server listening on port " + port));
}

startServer().catch(error => { console.error(error); process.exit(1); });
