import http from "node:http";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { cache } from "./redis/cache.js";
import { createApp } from "./app.js";
import { MatchScheduler } from "./cron/matchScheduler.js";
import { ScoreUpdater } from "./cron/scoreUpdater.js";
import { createProvider } from "./services/providerFactory.js";
import { MatchService } from "./services/matchService.js";
import { NotificationService } from "./services/notificationService.js";
import { ScoreService } from "./services/scoreService.js";
import { SeriesService } from "./services/seriesService.js";
import { startKeepAlive } from "./services/keepAlive.js";
import { LiveSocket } from "./sockets/liveSocket.js";

const provider = createProvider();
const matchService = new MatchService(provider);
const scoreService = new ScoreService(provider);
const seriesService = new SeriesService();
const notificationService = new NotificationService();

await cache.connect();
await connectDatabase();

const app = createApp(matchService, scoreService, seriesService);
const server = http.createServer(app);
const liveSocket = new LiveSocket(server);

const matchScheduler = new MatchScheduler(matchService, liveSocket, notificationService);
const scoreUpdater = new ScoreUpdater(matchService, scoreService, liveSocket, notificationService);
let seriesTimer: NodeJS.Timeout | undefined;
let keepAliveTimer: NodeJS.Timeout | undefined;

server.listen(env.PORT, () => {
  console.log(`Cricket live backend running on http://localhost:${env.PORT}`);
  matchScheduler.start();
  scoreUpdater.start();
  keepAliveTimer = startKeepAlive();
  void seriesService.refreshIplSeries().catch((error: unknown) => console.error("Initial IPL series scrape failed", error instanceof Error ? error.message : error));
  seriesTimer = setInterval(() => {
    void seriesService.refreshIplSeries().catch((error: unknown) => console.error("Scheduled IPL series scrape failed", error instanceof Error ? error.message : error));
  }, env.SERIES_SCRAPER_INTERVAL_MS);
});

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

function shutdown() {
  matchScheduler.stop();
  scoreUpdater.stop();
  if (seriesTimer) clearInterval(seriesTimer);
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  server.close(() => {
    console.log("Server stopped.");
    process.exit(0);
  });
}
