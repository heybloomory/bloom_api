import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).max(20).optional(),
  name: z.string().min(1).max(80).optional(),
  password: z.string().min(6).max(72),
}).refine((d) => d.email || d.phone, { message: "Provide email or phone" });

export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).max(20).optional(),
  password: z.string().min(6).max(72),
}).refine((d) => d.email || d.phone, { message: "Provide email or phone" });

// Bloom App (Flutter) expects dedicated endpoints for email login + OTP.
export const loginEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

export const sendOtpSchema = z.object({
  mobile: z.string().min(6).max(20),
});
