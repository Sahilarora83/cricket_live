import type { CommentaryItem, CricketMatch, LiveScore } from "../types/cricket.js";

export interface CricketProvider {
  fetchMatches(): Promise<CricketMatch[]>;
  findMatch?(query: string): Promise<CricketMatch | null>;
  fetchLiveScore(match: CricketMatch): Promise<LiveScore>;
  fetchCommentary(match: CricketMatch): Promise<CommentaryItem[]>;
}
