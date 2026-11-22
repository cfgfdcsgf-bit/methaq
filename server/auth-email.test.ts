import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  createLocalUser: vi.fn(),
  getUserByEmail: vi.fn(),
  createAuthToken: vi.fn(),
  applyAuthToken: vi.fn(),
  recordPasswordSignIn: vi.fn(),
}));
vi.mock("./_core/mailer", () => ({
  mailAvailable: vi.fn(() => true),
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock("./_core/passwords", () => ({
  hashPassword: vi.fn(async () => "scrypt$test-hash"),
  verifyPassword: vi.fn(async () => true),
}));

import * as db from "./db";
import { sendPasswordResetEmail, sendVerificationEmail } from "./_core/mailer";
import { appRouter } from "./routers";

function caller() {
  const ctx = {
    req: { ip: `test-${Math.random()}` },
    res: { cookie: vi.fn(), clearCookie: vi.fn() },
    user: null,
  } as never;
  return appRouter.createCaller(ctx);
}

beforeEach(() => vi.clearAllMocks());

describe("email authentication actions", () => {
  it("sends verification after registration without creating a session before confirmation", async () => {
    vi.mocked(db.createLocalUser).mockResolvedValue({ id: 17, email: "new@example.com", emailVerified: false, role: "user" } as never);
    vi.mocked(db.createAuthToken).mockResolvedValue("v".repeat(43));
    const c = caller();

    const result = await c.auth.localRegister({ name: "New User", email: "new@example.com", password: "Valid-Pass-928!" });

    expect(result).toEqual({ role: "user", verificationRequired: true, emailSent: true });
    expect(db.createAuthToken).toHaveBeenCalledWith(17, "verify-email", 24 * 60 * 60 * 1000);
    expect(sendVerificationEmail).toHaveBeenCalledWith("new@example.com", "v".repeat(43));
  });

  it("returns the same success response for an unknown verification address without sending mail", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(undefined as never);

    const result = await caller().auth.resendVerification({ email: "unknown@example.com" });

    expect(result).toEqual({ success: true });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("returns a non-enumerating password-reset response for an unknown address", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(undefined as never);

    const result = await caller().auth.requestPasswordReset({ email: "unknown@example.com" });

    expect(result).toEqual({ success: true });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("marks an email verified only after consuming a valid one-time token", async () => {
    vi.mocked(db.applyAuthToken).mockResolvedValue(true);

    const result = await caller().auth.verifyEmail({ token: "t".repeat(43) });

    expect(result).toEqual({ success: true });
    expect(db.applyAuthToken).toHaveBeenCalledWith("t".repeat(43), { type: "verify-email" });
  });

  it("changes the password only when the reset token is valid", async () => {
    vi.mocked(db.applyAuthToken).mockResolvedValue(true);

    const result = await caller().auth.resetPassword({ token: "r".repeat(43), password: "New-Strong-8!" });

    expect(result).toEqual({ success: true });
    expect(db.applyAuthToken).toHaveBeenCalledWith("r".repeat(43), { type: "reset-password", passwordHash: "scrypt$test-hash" });
  });
});
