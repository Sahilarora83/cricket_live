import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import type { ApiKeyService } from "../services/apiKeyService.js";
import { hashApiKey } from "../utils/apiKeys.js";

type Bucket = {
  count: number;
  resetAt: number;
};

const apiKeyBuckets = new Map<string, Bucket>();

export function createApiKeyAuth(apiKeyService: ApiKeyService) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const rawHeader = request.header("x-api-key") ?? request.header("authorization") ?? "";
    const apiKey = rawHeader.toLowerCase().startsWith("bearer ") ? rawHeader.slice(7).trim() : rawHeader.trim();

    if (!apiKey) {
      if (!env.API_REQUIRE_KEY) {
        response.setHeader("x-api-plan", "public-free");
        response.setHeader("x-api-quota-limit", "unlimited");
        response.setHeader("x-api-quota-used", "0");
        response.setHeader("x-api-quota-remaining", "unlimited");
        next();
        return;
      }
      response.status(401).json({ error: "Missing API key. Send x-api-key or Authorization: Bearer <key>." });
      return;
    }

    const rateLimitResult = consumeApiKeyRateLimit(apiKey);
    response.setHeader("x-api-key-rate-limit-limit", String(env.API_KEY_RATE_LIMIT_MAX));
    response.setHeader("x-api-key-rate-limit-remaining", String(rateLimitResult.remaining));
    response.setHeader("x-api-key-rate-limit-reset", String(Math.ceil(rateLimitResult.resetAt / 1000)));
    if (!rateLimitResult.ok) {
      response.setHeader("retry-after", String(rateLimitResult.retryAfterSeconds));
      response.status(429).json({ error: "API key rate limit exceeded. Please slow down and try again later." });
      return;
    }

    const result = await apiKeyService.consumeApiKey(apiKey);
    if (!result.ok) {
      response.status(result.status).json({ error: result.error });
      return;
    }

    response.setHeader("x-api-plan", result.usage.plan);
    response.setHeader("x-api-quota-limit", String(result.usage.monthlyQuota));
    response.setHeader("x-api-quota-used", String(result.usage.emailUsageCount));
    response.setHeader("x-api-quota-remaining", String(result.usage.remaining));
    response.setHeader("x-api-key-usage-used", String(result.usage.usageCount));
    next();
  };
}

function consumeApiKeyRateLimit(apiKey: string) {
  const now = Date.now();
  const key = `api-key:${hashApiKey(apiKey)}`;
  const existing = apiKeyBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + env.API_KEY_RATE_LIMIT_WINDOW_MS;
    apiKeyBuckets.set(key, { count: 1, resetAt });
    return { ok: true as const, remaining: Math.max(env.API_KEY_RATE_LIMIT_MAX - 1, 0), resetAt };
  }

  if (existing.count >= env.API_KEY_RATE_LIMIT_MAX) {
    return {
      ok: false as const,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(Math.ceil((existing.resetAt - now) / 1000), 1)
    };
  }

  existing.count += 1;
  return { ok: true as const, remaining: Math.max(env.API_KEY_RATE_LIMIT_MAX - existing.count, 0), resetAt: existing.resetAt };
}
