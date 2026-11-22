import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { mailAvailable } from "./mailer";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    if (error.code !== "INTERNAL_SERVER_ERROR") return shape;
    const { stack: _stack, ...data } = shape.data;
    return { ...shape, data, message: "حدث خطأ في الخادم. حاول مرة أخرى لاحقًا." };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

function requireVerifiedEmail(user: NonNullable<TrpcContext["user"]>) {
  if (mailAvailable() && !user.emailVerified) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أكد بريدك الإلكتروني للمتابعة." });
  }
}

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  requireVerifiedEmail(ctx.user);

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const ownerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "owner") {
      throw new TRPCError({ code: "FORBIDDEN", message: "هذه الصفحة متاحة لمالك الموقع فقط." });
    }
    requireVerifiedEmail(ctx.user);
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || (ctx.user.role !== "admin" && ctx.user.role !== "owner")) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    requireVerifiedEmail(ctx.user);

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
