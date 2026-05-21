import { env } from "../config/env.js";
import type { LiveSocket } from "../sockets/liveSocket.js";
import type { MatchService } from "../services/matchService.js";
import type { NotificationService } from "../services/notificationService.js";

export class MatchScheduler {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly matchService: MatchService,
    private readonly liveSocket: LiveSocket,
    private readonly notificationService: NotificationService
  ) {}

  start() {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), env.MATCH_SCHEDULER_INTERVAL_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;

    try {
      const result = await this.matchService.refreshMatches();
      this.liveSocket.emitMatches(result.matches);

      if (result.active && result.changed) {
        this.liveSocket.emitMatchChanged(result.active);
        await this.notificationService.sendMatchChanged(result.active);
      }
    } catch (error) {
      console.error("Match scheduler failed", error);
    } finally {
      this.running = false;
    }
  }
}
