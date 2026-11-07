import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./_core/passwords";

describe("passwords", () => {
  it("verifies the right password and rejects wrong, malformed or tampered hashes", async () => {
    const hash = await hashPassword("Correct-Horse-9!");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Correct-Horse-9!", hash)).toBe(true);
    expect(await verifyPassword("correct-horse-9!", hash)).toBe(false);
    expect(await verifyPassword("Correct-Horse-9!", "not-a-hash")).toBe(false);
    expect(await verifyPassword("Correct-Horse-9!", hash.replace(/\$16384\$/, "$2$"))).toBe(false);
  });
  it("salts every hash differently", async () => {
    expect(await hashPassword("Same-Password-1!")).not.toBe(await hashPassword("Same-Password-1!"));
  });
});
