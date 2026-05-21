import type { CommentaryItem, CricketMatch, LiveScore } from "../types/cricket.js";

export class NotificationService {
  async sendMatchChanged(match: CricketMatch) {
    console.log(`Notification ready: active match changed to ${match.team1} vs ${match.team2}`);
  }

  async sendScoreEvent(score: LiveScore, commentary: CommentaryItem[]) {
    const event = commentary.find((item) => item.event === "WICKET" || item.event === "SIX" || item.event === "FOUR");
    if (!event) return;
    console.log(`Notification ready: ${event.event} in ${score.matchId}`);
  }
}
