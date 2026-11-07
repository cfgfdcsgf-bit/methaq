import type { CookieOptions, Request } from "express";

export function getSessionCookieOptions(req: Request): CookieOptions {
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isHttps = req.secure || forwardedProto === "https";
  return { httpOnly: true, path: "/", sameSite: "lax", secure: isHttps };
}
