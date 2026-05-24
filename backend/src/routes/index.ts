import { Router } from "express";
import type { DeveloperController } from "../controllers/developerController.js";
import type { MatchController } from "../controllers/matchController.js";
import type { SeriesController } from "../controllers/seriesController.js";
import { env } from "../config/env.js";
import { createApiKeyAuth } from "../middleware/apiKeyAuth.js";
import { createRateLimit } from "../middleware/rateLimit.js";
import { requireRefreshSecret } from "../middleware/requireRefreshSecret.js";
import type { ApiKeyService } from "../services/apiKeyService.js";
import { getSystemStatus } from "../services/systemStatus.js";

export function createRoutes(
  controller: MatchController,
  seriesController: SeriesController,
  developerController: DeveloperController,
  apiKeyService: ApiKeyService
) {
  const router = Router();
  const apiKeyAuth = createApiKeyAuth(apiKeyService);
  const publicRateLimit = createRateLimit({
    windowMs: env.PUBLIC_RATE_LIMIT_WINDOW_MS,
    max: env.PUBLIC_RATE_LIMIT_MAX,
    name: "public"
  });
  const developerRateLimit = createRateLimit({
    windowMs: env.DEVELOPER_RATE_LIMIT_WINDOW_MS,
    max: env.DEVELOPER_RATE_LIMIT_MAX,
    name: "developer"
  });
  const trackMatchRateLimit = createRateLimit({
    windowMs: env.TRACK_MATCH_RATE_LIMIT_WINDOW_MS,
    max: env.TRACK_MATCH_RATE_LIMIT_MAX,
    name: "track-match"
  });

  router.get("/matches", publicRateLimit, controller.getMatches);
  router.get("/live-match", publicRateLimit, controller.getLiveMatch);
  router.post("/track-match", trackMatchRateLimit, controller.trackMatch);
  router.get("/score/:matchId", publicRateLimit, controller.getScore);
  router.get("/score-history/:matchId", publicRateLimit, controller.getScoreHistory);
  router.get("/commentary/:matchId", publicRateLimit, controller.getCommentary);
  router.get("/series/ipl-2026", publicRateLimit, seriesController.getIplSeries);
  router.post("/series/ipl-2026/refresh", requireRefreshSecret, seriesController.refreshIplSeries);
  router.get("/system-status", publicRateLimit, (_request, response) => response.json({ data: getSystemStatus() }));
  router.get("/developer/api-keys", developerController.getApiKeyPortal);
  router.get("/developer/widget.js", developerController.getWidgetScript);
  router.get("/developer/api-keys/me", developerRateLimit, developerController.getMyApiKeys);
  router.post("/developer/api-key-otp", developerRateLimit, developerController.requestApiKeyOtp);
  router.post("/developer/api-keys", developerRateLimit, developerController.createApiKey);
  router.post("/developer/api-keys/revoke", developerRateLimit, developerController.revokeApiKeys);

  router.get("/v1/matches", apiKeyAuth, controller.getMatches);
  router.get("/v1/live-match", apiKeyAuth, controller.getLiveMatch);
  router.get("/v1/score/:matchId", apiKeyAuth, controller.getScore);
  router.get("/v1/score-history/:matchId", apiKeyAuth, controller.getScoreHistory);
  router.get("/v1/commentary/:matchId", apiKeyAuth, controller.getCommentary);
  router.get("/v1/series/ipl-2026", apiKeyAuth, seriesController.getIplSeries);

  return router;
}
