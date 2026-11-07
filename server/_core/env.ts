import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function localSessionSecret() {
  const secretPath = path.resolve(process.cwd(), ".meethaq-session-secret");
  try {
    return fs.readFileSync(secretPath, "utf8").trim();
  } catch {
    const secret = randomBytes(48).toString("base64url");
    try {
      fs.writeFileSync(secretPath, secret, { flag: "wx", mode: 0o600 });
      return secret;
    } catch {
      return fs.readFileSync(secretPath, "utf8").trim();
    }
  }
}

export const ENV = {
  get appId() { return process.env.MANUS_PROJECT_ID || "meethaq-local"; },
  get cookieSecret() {
    const configured = process.env.MEETHAQ_SESSION_SECRET || process.env.MANUS_JWT_SECRET;
    if (configured) return configured;
    return process.env.NODE_ENV === "production" ? "" : localSessionSecret();
  },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get oAuthServerUrl() { return process.env.MANUS_OAUTH_API_URL ?? ""; },
  // Preserve the legacy hint when supplied; otherwise roles remain application data.
  get ownerOpenId() { return process.env.OWNER_OPEN_ID ?? ""; },
  get ownerEmail() { return (process.env.OWNER_EMAIL?.trim() ?? "").toLowerCase(); },
  get googleClientId() { return process.env.GOOGLE_CLIENT_ID?.trim() ?? ""; },
  get googleClientSecret() { return process.env.GOOGLE_CLIENT_SECRET?.trim() ?? ""; },
  get googleRedirectUri() { return process.env.GOOGLE_REDIRECT_URI?.trim() ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get forgeApiUrl() { return process.env.MANUS_API_URL ?? ""; },
  get forgeApiKey() { return process.env.MANUS_API_KEY ?? ""; },
  get openaiApiKey() { return process.env.OPENAI_API_KEY ?? ""; },
  get openaiApiBaseUrl() { return (process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""); },
  get openaiModel() { return process.env.OPENAI_MODEL ?? ""; },
};
