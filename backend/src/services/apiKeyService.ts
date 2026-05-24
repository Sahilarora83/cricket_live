import { ApiKeyModel } from "../models/ApiKey.js";
import { ApiKeyOtpModel } from "../models/ApiKeyOtp.js";
import { env } from "../config/env.js";
import { canPersist } from "../utils/persistence.js";
import { currentUsageMonth, generateApiKey, generateOtpCode, hashApiKey, hashOtp } from "../utils/apiKeys.js";
import { canSendEmail, sendOtpEmail } from "./emailService.js";

export class ApiKeyServiceError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export class ApiKeyService {
  async requestOtp(input: { email: string; purpose: "create" | "revoke" }) {
    if (!canPersist()) {
      throw new ApiKeyServiceError("MongoDB is required for API key verification", 503);
    }

    const email = normalizeEmail(input.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiKeyServiceError("Valid email is required", 400);
    }

    const recent = await ApiKeyOtpModel.findOne({ email, purpose: input.purpose }).sort({ createdAt: -1 }).lean();
    if (recent?.createdAt) {
      const secondsSinceLastOtp = (Date.now() - new Date(recent.createdAt).getTime()) / 1000;
      if (secondsSinceLastOtp < env.API_KEY_OTP_RESEND_SECONDS) {
        throw new ApiKeyServiceError(`Please wait ${Math.ceil(env.API_KEY_OTP_RESEND_SECONDS - secondsSinceLastOtp)} seconds before requesting another code.`, 429);
      }
    }

    const code = generateOtpCode();
    await ApiKeyOtpModel.create({
      email,
      codeHash: hashOtp(email, code, input.purpose),
      purpose: input.purpose,
      expiresAt: new Date(Date.now() + env.API_KEY_OTP_TTL_MINUTES * 60 * 1000)
    });

    const delivery = await sendOtpEmail({ email, code, purpose: input.purpose });
    return {
      email,
      delivered: delivery.delivered,
      expiresInMinutes: env.API_KEY_OTP_TTL_MINUTES,
      resendAfterSeconds: env.API_KEY_OTP_RESEND_SECONDS,
      devCode: canSendEmail() || env.NODE_ENV === "production" ? undefined : code
    };
  }

  async createApiKey(input: { name: string; email: string; otp?: string; verifiedByGoogle?: boolean }) {
    if (!canPersist()) {
      throw new ApiKeyServiceError("MongoDB is required to generate API keys", 503);
    }

    const name = input.name.trim();
    const email = normalizeEmail(input.email);
    if (!name) {
      throw new ApiKeyServiceError("App name is required", 400);
    }
    if (!input.verifiedByGoogle) {
      await this.verifyOtp(email, input.otp || "", "create");
    }

    const activeKeyCount = await ApiKeyModel.countDocuments({ email, revoked: false });
    if (activeKeyCount >= env.API_MAX_ACTIVE_KEYS_PER_EMAIL) {
      throw new ApiKeyServiceError(
        `This email already has ${activeKeyCount} active API key${activeKeyCount === 1 ? "" : "s"}. Limit is ${env.API_MAX_ACTIVE_KEYS_PER_EMAIL} per email.`,
        409
      );
    }
    await this.assertCreateAllowed(email);

    const { key, keyPrefix } = generateApiKey();
    const record = await ApiKeyModel.create({
      name,
      email,
      keyPrefix,
      keyHash: hashApiKey(key),
      allowedOrigins: [],
      plan: "open-source",
      monthlyQuota: env.API_FREE_MONTHLY_QUOTA,
      usageMonth: currentUsageMonth(),
      usageCount: 0
    });

    return {
      key,
      keyPrefix: record.keyPrefix,
      allowedOrigins: [],
      plan: record.plan,
      monthlyQuota: record.monthlyQuota,
      maxActiveKeysPerEmail: env.API_MAX_ACTIVE_KEYS_PER_EMAIL,
      usageCount: record.usageCount,
      usageMonth: record.usageMonth,
      remaining: record.monthlyQuota
    };
  }

  async revokeApiKeys(input: { email: string; otp?: string; keyPrefix?: string; verifiedByGoogle?: boolean }) {
    if (!canPersist()) {
      throw new ApiKeyServiceError("MongoDB is required to revoke API keys", 503);
    }

    const email = normalizeEmail(input.email);
    if (!input.verifiedByGoogle) {
      await this.verifyOtp(email, input.otp || "", "revoke");
    }

    const filter: Record<string, unknown> = { email, revoked: false };
    if (input.keyPrefix?.trim()) {
      filter.keyPrefix = input.keyPrefix.trim();
    }

    const result = await ApiKeyModel.updateMany(filter, { $set: { revoked: true, revokedAt: new Date() } });
    if (result.modifiedCount === 0) {
      throw new ApiKeyServiceError("No active API key found for this email.", 404);
    }

    return { revoked: result.modifiedCount };
  }

  async listApiKeysForEmail(emailInput: string) {
    if (!canPersist()) {
      throw new ApiKeyServiceError("MongoDB is required to load API key usage", 503);
    }

    const email = normalizeEmail(emailInput);
    const usageMonth = currentUsageMonth();
    const keys = await ApiKeyModel.find({ email })
      .sort({ revoked: 1, createdAt: -1 })
      .limit(20)
      .lean();
    const activeKeys = keys.filter((key) => !key.revoked);
    const emailUsageCount = activeKeys
      .filter((key) => key.usageMonth === usageMonth)
      .reduce((total, key) => total + Number(key.usageCount || 0), 0);
    const monthlyQuota = activeKeys[0]?.monthlyQuota ?? env.API_FREE_MONTHLY_QUOTA;

    return {
      email,
      usageMonth,
      monthlyQuota,
      emailUsageCount,
      remaining: Math.max(monthlyQuota - emailUsageCount, 0),
      activeKeyCount: activeKeys.length,
      maxActiveKeysPerEmail: env.API_MAX_ACTIVE_KEYS_PER_EMAIL,
      rateLimit: {
        limit: env.API_KEY_RATE_LIMIT_MAX,
        windowMs: env.API_KEY_RATE_LIMIT_WINDOW_MS
      },
      limits: {
        dailyCreateLimit: env.API_KEY_DAILY_CREATE_LIMIT,
        createCooldownSeconds: env.API_KEY_CREATE_COOLDOWN_SECONDS,
        revokeCooldownSeconds: env.API_KEY_REVOKE_COOLDOWN_SECONDS
      },
      keys: keys.map((key) => ({
        name: key.name,
        email: key.email,
        keyPrefix: key.keyPrefix,
        plan: key.plan,
        monthlyQuota: key.monthlyQuota,
        usageMonth: key.usageMonth,
        usageCount: key.usageMonth === usageMonth ? key.usageCount : 0,
        remaining: key.revoked || key.usageMonth !== usageMonth ? key.monthlyQuota : Math.max(key.monthlyQuota - key.usageCount, 0),
        revoked: key.revoked,
        createdAt: key.createdAt,
        revokedAt: key.revokedAt,
        lastUsedAt: key.lastUsedAt
      }))
    };
  }

  async consumeApiKey(rawKey: string) {
    if (!canPersist()) {
      return { ok: false as const, status: 503, error: "API key storage is unavailable" };
    }

    const keyHash = hashApiKey(rawKey);
    const apiKey = await ApiKeyModel.findOne({ keyHash, revoked: false });
    if (!apiKey) {
      return { ok: false as const, status: 401, error: "Invalid API key" };
    }

    const usageMonth = currentUsageMonth();
    if (apiKey.usageMonth !== usageMonth) {
      apiKey.usageMonth = usageMonth;
      apiKey.usageCount = 0;
    }

    const emailUsage = await ApiKeyModel.aggregate<{ total: number }>([
      {
        $match: {
          email: apiKey.email,
          revoked: false,
          usageMonth
        }
      },
      {
        $group: {
          _id: "$email",
          total: { $sum: "$usageCount" }
        }
      }
    ]);
    const emailUsageCount = emailUsage[0]?.total ?? 0;

    if (emailUsageCount >= apiKey.monthlyQuota) {
      return { ok: false as const, status: 429, error: "Monthly API quota exceeded" };
    }

    apiKey.usageCount += 1;
    apiKey.lastUsedAt = new Date();
    await apiKey.save();
    const updatedEmailUsageCount = emailUsageCount + 1;

    return {
      ok: true as const,
      usage: {
        keyPrefix: apiKey.keyPrefix,
        plan: apiKey.plan,
        monthlyQuota: apiKey.monthlyQuota,
        usageMonth: apiKey.usageMonth,
        usageCount: apiKey.usageCount,
        emailUsageCount: updatedEmailUsageCount,
        remaining: Math.max(apiKey.monthlyQuota - updatedEmailUsageCount, 0)
      }
    };
  }

  private async assertCreateAllowed(email: string) {
    if (env.API_KEY_CREATE_COOLDOWN_SECONDS > 0) {
      const lastKey = await ApiKeyModel.findOne({ email }).sort({ createdAt: -1 }).lean();
      if (lastKey?.createdAt) {
        const secondsSinceLastKey = (Date.now() - new Date(lastKey.createdAt).getTime()) / 1000;
        if (secondsSinceLastKey < env.API_KEY_CREATE_COOLDOWN_SECONDS) {
          throw new ApiKeyServiceError(
            `Please wait ${Math.ceil(env.API_KEY_CREATE_COOLDOWN_SECONDS - secondsSinceLastKey)} seconds before generating another key.`,
            429
          );
        }
      }
    }

    if (env.API_KEY_REVOKE_COOLDOWN_SECONDS > 0) {
      const lastRevokedKey = await ApiKeyModel.findOne({ email, revoked: true, revokedAt: { $exists: true } }).sort({ revokedAt: -1 }).lean();
      if (lastRevokedKey?.revokedAt) {
        const secondsSinceRevoke = (Date.now() - new Date(lastRevokedKey.revokedAt).getTime()) / 1000;
        if (secondsSinceRevoke < env.API_KEY_REVOKE_COOLDOWN_SECONDS) {
          throw new ApiKeyServiceError(
            `Please wait ${Math.ceil(env.API_KEY_REVOKE_COOLDOWN_SECONDS - secondsSinceRevoke)} seconds after revoking before generating a new key.`,
            429
          );
        }
      }
    }

    const dayStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const keysCreatedToday = await ApiKeyModel.countDocuments({ email, createdAt: { $gte: dayStart } });
    if (keysCreatedToday >= env.API_KEY_DAILY_CREATE_LIMIT) {
      throw new ApiKeyServiceError(
        `Daily API key generation limit reached. You can create ${env.API_KEY_DAILY_CREATE_LIMIT} key${env.API_KEY_DAILY_CREATE_LIMIT === 1 ? "" : "s"} per 24 hours.`,
        429
      );
    }
  }

  private async verifyOtp(email: string, code: string, purpose: "create" | "revoke") {
    const normalizedEmail = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new ApiKeyServiceError("Valid email is required", 400);
    }

    const otp = await ApiKeyOtpModel.findOne({
      email: normalizedEmail,
      purpose,
      consumedAt: { $exists: false },
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!otp) {
      throw new ApiKeyServiceError("OTP is invalid or expired.", 401);
    }

    if (otp.attempts >= env.API_KEY_OTP_MAX_ATTEMPTS) {
      throw new ApiKeyServiceError("Too many OTP attempts. Request a new code.", 429);
    }

    if (otp.codeHash !== hashOtp(normalizedEmail, code.trim(), purpose)) {
      otp.attempts += 1;
      await otp.save();
      throw new ApiKeyServiceError("OTP is invalid or expired.", 401);
    }

    otp.consumedAt = new Date();
    await otp.save();
  }
}
