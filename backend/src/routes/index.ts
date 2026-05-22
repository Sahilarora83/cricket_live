import { Router } from "express";
import type { DeveloperController } from "../controllers/developerController.js";
import type { MatchController } from "../controllers/matchController.js";
import type { SeriesController } from "../controllers/seriesController.js";
import { createApiKeyAuth } from "../middleware/apiKeyAuth.js";
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

  router.get("/matches", controller.getMatches);
  router.get("/live-match", controller.getLiveMatch);
  router.post("/track-match", controller.trackMatch);
  router.get("/score/:matchId", controller.getScore);
  router.get("/score-history/:matchId", controller.getScoreHistory);
  router.get("/commentary/:matchId", controller.getCommentary);
  router.get("/series/ipl-2026", seriesController.getIplSeries);
  router.post("/series/ipl-2026/refresh", seriesController.refreshIplSeries);
  router.get("/system-status", (_request, response) => response.json({ data: getSystemStatus() }));
  router.get("/developer/api-keys", developerController.getApiKeyPortal);
  router.post("/developer/api-keys", developerController.createApiKey);

  router.get("/v1/matches", apiKeyAuth, controller.getMatches);
  router.get("/v1/live-match", apiKeyAuth, controller.getLiveMatch);
  router.get("/v1/score/:matchId", apiKeyAuth, controller.getScore);
  router.get("/v1/score-history/:matchId", apiKeyAuth, controller.getScoreHistory);
  router.get("/v1/commentary/:matchId", apiKeyAuth, controller.getCommentary);
  router.get("/v1/series/ipl-2026", apiKeyAuth, seriesController.getIplSeries);

  return router;
}
