import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { getDatabaseStatus } from "./config/database.js";
import { env } from "./config/env.js";
import { DeveloperController } from "./controllers/developerController.js";
import { MatchController } from "./controllers/matchController.js";
import { SeriesController } from "./controllers/seriesController.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createRoutes } from "./routes/index.js";
import type { MatchService } from "./services/matchService.js";
import { ApiKeyService } from "./services/apiKeyService.js";
import type { ScoreService } from "./services/scoreService.js";
import type { SeriesService } from "./services/seriesService.js";
import { getSystemStatus } from "./services/systemStatus.js";

export function createApp(matchService: MatchService, scoreService: ScoreService, seriesService: SeriesService) {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
  app.use(cors({ origin: true }));
  app.use(express.json());
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use("/assets", express.static(path.resolve(process.cwd(), "public", "assets")));

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      service: "cricket-live-system",
      mongodb: getDatabaseStatus(),
      system: getSystemStatus(),
      timestamp: new Date().toISOString()
    });
  });

  const controller = new MatchController(matchService, scoreService);
  const seriesController = new SeriesController(seriesService);
  const apiKeyService = new ApiKeyService();
  const developerController = new DeveloperController(apiKeyService);
  app.use("/api", createRoutes(controller, seriesController, developerController, apiKeyService));
  app.use(errorHandler);

  return app;
}
