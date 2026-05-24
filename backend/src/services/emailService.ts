import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export function canSendEmail() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS);
}

export async function sendOtpEmail(input: { email: string; code: string; purpose: "create" | "revoke" }) {
  if (!canSendEmail()) {
    if (env.NODE_ENV !== "production") {
      console.log(`Developer API ${input.purpose} OTP for ${input.email}: ${input.code}`);
    }
    return { delivered: false };
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: input.email,
    subject: "Cricket Live API verification code",
    text: `Your Cricket Live API ${input.purpose === "create" ? "key generation" : "key revoke"} code is ${input.code}. It expires in ${env.API_KEY_OTP_TTL_MINUTES} minutes.`
  });

  return { delivered: true };
}
