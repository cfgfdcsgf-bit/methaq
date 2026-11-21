import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import { HttpError } from "@shared/_core/errors";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Most visitors are anonymous: skip the database lookup and the error path entirely.
  const cookies = opts.req.headers?.cookie ?? "";
  if (!cookies.includes(COOKIE_NAME + "=")) {
    return { req: opts.req, res: opts.res, user: null };
  }

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    if (!(error instanceof HttpError && error.statusCode === 403)) throw error;
    // An expired or revoked cookie is harmless for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
