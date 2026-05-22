import { ApiKeyModel } from "../models/ApiKey.js";
import { env } from "../config/env.js";
import { canPersist } from "../utils/persistence.js";
import { currentUsageMonth, generateApiKey, hashApiKey } from "../utils/apiKeys.js";

export class ApiKeyService {
  async createApiKey(input: { name: string; email: string }) {
    if (!canPersist()) {
      throw new Error("MongoDB is required to generate API keys");
    }

    const { key, keyPrefix } = generateApiKey();
    const record = await ApiKeyModel.create({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      keyPrefix,
      keyHash: hashApiKey(key),
      plan: "open-source",
      monthlyQuota: env.API_FREE_MONTHLY_QUOTA,
      usageMonth: currentUsageMonth(),
      usageCount: 0
    });

    return {
      key,
      keyPrefix: record.keyPrefix,
      plan: record.plan,
      monthlyQuota: record.monthlyQuota,
      usageCount: record.usageCount,
      usageMonth: record.usageMonth
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

    if (apiKey.usageCount >= apiKey.monthlyQuota) {
      return { ok: false as const, status: 429, error: "Monthly API quota exceeded" };
    }

    apiKey.usageCount += 1;
    apiKey.lastUsedAt = new Date();
    await apiKey.save();

    return {
      ok: true as const,
      usage: {
        keyPrefix: apiKey.keyPrefix,
        plan: apiKey.plan,
        monthlyQuota: apiKey.monthlyQuota,
        usageMonth: apiKey.usageMonth,
        usageCount: apiKey.usageCount,
        remaining: Math.max(apiKey.monthlyQuota - apiKey.usageCount, 0)
      }
    };
  }
}
