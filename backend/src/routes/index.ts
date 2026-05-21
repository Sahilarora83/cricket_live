import { Router } from "express";
import type { MatchController } from "../controllers/matchController.js";
import type { SeriesController } from "../controllers/seriesController.js";

export function createRoutes(controller: MatchController, seriesController: SeriesController) {
  const router = Router();

  router.get("/matches", controller.getMatches);
  router.get("/live-match", controller.getLiveMatch);
  router.post("/track-match", controller.trackMatch);
  router.get("/score/:matchId", controller.getScore);
  router.get("/score-history/:matchId", controller.getScoreHistory);
  router.get("/commentary/:matchId", controller.getCommentary);
  router.get("/series/ipl-2026", seriesController.getIplSeries);
  router.post("/series/ipl-2026/refresh", seriesController.refreshIplSeries);

  return router;
}
