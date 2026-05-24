import crypto from "node:crypto";

const API_KEY_PREFIX = "cricket_live";

export function generateApiKey() {
  const secret = crypto.randomBytes(32).toString("base64url");
  const key = `${API_KEY_PREFIX}_${secret}`;
  return {
    key,
    keyPrefix: key.slice(0, 24)
  };
}

export function hashApiKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashOtp(email: string, code: string, purpose: string) {
  return crypto.createHash("sha256").update(`${email}:${purpose}:${code}`).digest("hex");
}

export function currentUsageMonth(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
