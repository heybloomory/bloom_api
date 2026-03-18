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

export const verifyOtpSchema = z.object({
  phone: z.string().min(6).max(20),
  otp: z.string().min(4).max(8), // OTP is expected to be numeric, but allow flexible dev formats
});

export const sendEmailOtpSchema = z.object({
  email: z.string().email(),
});

export const verifyEmailOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(4).max(8),
});

export const completeProfileSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().optional(),
  dateOfBirth: z
    .string()
    .min(8)
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid dateOfBirth" }),
});
