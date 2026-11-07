import { createHash, randomBytes } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME } from "@shared/const";
import * as db from "../db";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

const STATE_COOKIE = "meethaq-google-state";
const NONCE_COOKIE = "meethaq-google-nonce";
const VERIFIER_COOKIE = "meethaq-google-verifier";
const FLOW_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const googleConfigured = () => Boolean(ENV.googleClientId && ENV.googleClientSecret && ENV.googleRedirectUri);
const randomToken = () => randomBytes(32).toString("base64url");
const codeChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

function clearFlowCookies(req: Request, res: Response) {
  const options = getSessionCookieOptions(req);
  for (const name of [STATE_COOKIE, NONCE_COOKIE, VERIFIER_COOKIE]) {
    res.clearCookie(name, { path: "/", httpOnly: true, secure: options.secure, sameSite: options.sameSite });
  }
}

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/auth/google/status", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ enabled: googleConfigured() });
  });

  app.get("/api/auth/google/start", (req, res) => {
    if (!googleConfigured()) {
      res.redirect(302, "/login?auth_error=google");
      return;
    }

    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken();
    const cookieOptions = {
      ...getSessionCookieOptions(req),
      maxAge: FLOW_TTL_MS,
    };
    res.cookie(STATE_COOKIE, state, cookieOptions);
    res.cookie(NONCE_COOKIE, nonce, cookieOptions);
    res.cookie(VERIFIER_COOKIE, verifier, cookieOptions);

    const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorize.search = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: ENV.googleRedirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: codeChallenge(verifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    res.redirect(302, authorize.toString());
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const nonce = cookies[NONCE_COOKIE] ?? "";
    const verifier = cookies[VERIFIER_COOKIE] ?? "";
    const expectedState = cookies[STATE_COOKIE] ?? "";
    clearFlowCookies(req, res);

    if (!googleConfigured() || !code || !state || !expectedState || state !== expectedState || !nonce || !verifier) {
      res.redirect(302, "/login?auth_error=google");
      return;
    }

    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: ENV.googleRedirectUri,
          grant_type: "authorization_code",
          code_verifier: verifier,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const tokenData = await tokenResponse.json() as { id_token?: unknown };
      if (!tokenResponse.ok || typeof tokenData.id_token !== "string") throw new Error("Google token exchange failed");

      const { payload } = await jwtVerify(tokenData.id_token, GOOGLE_JWKS, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: ENV.googleClientId,
      });
      const subject = typeof payload.sub === "string" ? payload.sub : "";
      const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      const name = typeof payload.name === "string" ? payload.name.slice(0, 100) : null;
      if (!subject || !email || payload.email_verified !== true || payload.nonce !== nonce) {
        throw new Error("Google identity could not be verified");
      }

      const user = await db.upsertGoogleUser({ subject, email, name });
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name ?? name ?? "",
        expiresInMs: SESSION_TTL_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: SESSION_TTL_MS,
      });
      res.redirect(302, user.role === "owner" ? "/owner" : "/");
    } catch (error) {
      console.error("[Google OAuth] Sign-in failed:", error instanceof Error ? error.message : "unknown error");
      res.redirect(302, "/login?auth_error=google");
    }
  });
}
