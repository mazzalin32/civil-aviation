import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Enter your password"),
});

export const totpCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const backupCodeSchema = z.object({
  code: z.string().min(1, "Enter a backup code"),
});

export const forgotPasswordSchema = z.object({
  email: z.email(),
});

/** Better Auth (haveIBeenPwned + minPasswordLength) enforces the rest server-side. */
export const newPasswordSchema = z
  .object({
    password: z.string().min(10, "Use at least 10 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: z.string().min(10, "Use at least 10 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const twoFactorSetupSchema = z.object({
  password: z.string().min(1, "Enter your password"),
});
