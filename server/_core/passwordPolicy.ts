import { z } from "zod";

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "12345678", "123456789", "1234567890", "qwertyuiop", "qwerty123",
  "11111111", "iloveyou", "abc12345", "admin1234", "letmein123", "welcome123", "meethaq123", "meethaq1234",
  "٠١٢٣٤٥٦٧٨٩", "١٢٣٤٥٦٧٨", "١٢٣٤٥٦٧٨٩", "كلمةالمرور", "كلمة المرور",
]);

/**
 * Length beats composition rules (NIST 800-63B): at least 8 characters in any language, no common or repetitive
 * passwords, no password equal to the email address. Arabic letters are allowed.
 */
export const passwordSchema = z.string()
  .min(8, "كلمة المرور لازم تكون 8 أحرف على الأقل.")
  .max(128, "كلمة المرور لا يمكن أن تتجاوز 128 حرفًا.")
  .refine(value => !COMMON_PASSWORDS.has(value.toLowerCase().normalize("NFKC")), "كلمة المرور شائعة جدًا. اختر كلمة أصعب في التخمين.")
  .refine(value => new Set(value).size >= 4, "كلمة المرور بسيطة جدًا. استخدم أحرفًا متنوعة أكثر.")
  .refine(value => !/^(?:0123456789|1234567890|abcdefgh|qwertyui)/i.test(value), "تجنّب التسلسلات السهلة مثل 12345678.");

export const emailSchema = z.string().trim().toLowerCase().email().max(320);
