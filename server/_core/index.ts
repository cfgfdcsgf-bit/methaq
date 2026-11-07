import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { ENV } from "./env";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleAuthRoutes } from "./googleAuth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  if (ENV.isProduction && !ENV.cookieSecret) {
    throw new Error("MEETHAQ_SESSION_SECRET is required in production. Set a long random value in the host's environment variables.");
  }
  if (!ENV.ownerEmail) console.warn("[Auth] OWNER_EMAIL is not set: no account can become the site owner until you set it in .env.");
  const app = express();
  // Behind a hosting reverse proxy, req.ip must be the visitor (not the proxy) or all visitors share one login rate limit.
  const trustProxy = process.env.TRUST_PROXY ?? (ENV.isProduction ? "1" : "0");
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  const server = createServer(app);
  // tRPC importMany (500 items) needs a few MB at most; keep the limit modest.
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/rafiq/status", (_req, res) => {
    const manusReady = Boolean(ENV.forgeApiUrl.trim() && ENV.forgeApiKey);
    const openAiReady = Boolean(ENV.openaiApiKey && ENV.openaiModel);
    res.set("Cache-Control", "no-store").json({ enabled: manusReady || openAiReady });
  });
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  registerOAuthRoutes(app);
  registerGoogleAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

startServer().catch(error => { console.error(error); process.exit(1); });
