import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import * as db from "../db";
import { ENV } from "./env";

export type SessionPayload = { openId: string; appId: string; name: string; tv?: number };
const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;

class SessionService {
  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret) throw new Error("The session signing secret is unavailable");
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a stored account
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string; tokenVersion?: number } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
        tv: options.tokenVersion ?? 0,
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
      tv: payload.tv ?? 0,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string; tv: number } | null> {
    // Anonymous visitors have no cookie; that is normal and not worth a log line.
    if (!cookieValue) return null;

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name, tv } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        (!isNonEmptyString(appId) || appId !== ENV.appId) ||
        typeof name !== "string"
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
        tv: typeof tv === "number" && Number.isInteger(tv) ? tv : 0,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request) {
    const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
    const session = await this.verifySession(token);
    if (!session) throw ForbiddenError("Invalid session cookie");
    const user = await db.getUserByOpenId(session.openId);
    if (!user || (session.openId.startsWith("local-") && !user.passwordHash)) {
      throw ForbiddenError("User not found");
    }
    if (session.tv !== user.tokenVersion) throw ForbiddenError("Session was revoked");
    return user;
  }
}

export const sdk = new SessionService();
