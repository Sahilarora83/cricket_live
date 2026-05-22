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

export function currentUsageMonth(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
