import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import type { ApiKeyService } from "../services/apiKeyService.js";

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

    const result = await apiKeyService.consumeApiKey(apiKey, {
      origin: request.header("origin") ?? undefined,
      referer: request.header("referer") ?? undefined
    });
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
