import { env } from "../config/env.js";
import type { LiveSocket } from "../sockets/liveSocket.js";
import type { MatchService } from "../services/matchService.js";
import type { NotificationService } from "../services/notificationService.js";
import type { ScoreService } from "../services/scoreService.js";

export class ScoreUpdater {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly matchService: MatchService,
    private readonly scoreService: ScoreService,
    private readonly liveSocket: LiveSocket,
    private readonly notificationService: NotificationService
  ) {}

  start() {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), env.SCORE_UPDATER_INTERVAL_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;

    try {
      const match = await this.matchService.getActiveMatch();
      if (!match) return;

      const score = await this.scoreService.refreshScore(match);
      const commentary = await this.scoreService.refreshCommentary(match);

      this.liveSocket.emitScore(score);
      this.liveSocket.emitCommentary(match.id, commentary);
      await this.notificationService.sendScoreEvent(score, commentary);
    } catch (error) {
      console.error("Score updater failed", error);
    } finally {
      this.running = false;
    }
  }
}
