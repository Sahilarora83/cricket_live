import { LiveScoreModel } from "../models/LiveScore.js";
import { CommentaryModel } from "../models/Commentary.js";
import { ScoreSnapshotModel } from "../models/ScoreSnapshot.js";
import { env } from "../config/env.js";
import { cache } from "../redis/cache.js";
import type { CommentaryItem, CricketMatch, LiveScore } from "../types/cricket.js";
import { canPersist } from "../utils/persistence.js";
import type { CricketProvider } from "./provider.js";

export class ScoreService {
  constructor(private readonly provider: CricketProvider) {}

  async refreshScore(match: CricketMatch) {
    const score = await this.provider.fetchLiveScore(match);
    await cache.set(scoreKey(match.id), score, 30);

    if (canPersist()) {
      const scrapedAt = new Date(score.updatedAt);

      await LiveScoreModel.updateOne(
        { matchId: match.id },
        {
          $set: {
            ...score,
            scrapedAt
          }
        },
        { upsert: true }
      );

      await ScoreSnapshotModel.create({
        ...score,
        scrapedAt
      });
    }

    return score;
  }

  async refreshCommentary(match: CricketMatch) {
    const commentary = await this.provider.fetchCommentary(match);
    await cache.set(commentaryKey(match.id), commentary, 60);

    if (canPersist()) {
      await Promise.allSettled(
        commentary.map((item) =>
          CommentaryModel.updateOne(
            { matchId: item.matchId, description: item.description },
            {
              $set: {
                matchId: item.matchId,
                over: item.over,
                ball: item.ball,
                event: item.event,
                description: item.description
              }
            },
            { upsert: true }
          )
        )
      );
    }

    return commentary.slice(0, env.COMMENTARY_LIMIT);
  }

  async getScore(matchId: string) {
    const cached = await cache.get<LiveScore>(scoreKey(matchId));
    if (cached) return cached;

    if (!canPersist()) return null;

    const stored = await LiveScoreModel.findOne({ matchId }).sort({ scrapedAt: -1 }).lean();
    if (!stored) return null;

    const { _id, __v, createdAt, updatedAt, scrapedAt, ...score } = stored as Record<string, unknown>;
    const normalized = {
      ...score,
      updatedAt:
        typeof updatedAt === "string"
          ? updatedAt
          : updatedAt instanceof Date
            ? updatedAt.toISOString()
            : scrapedAt instanceof Date
              ? scrapedAt.toISOString()
              : new Date().toISOString()
    } as LiveScore;

    await cache.set(scoreKey(matchId), normalized, 30);
    return normalized;
  }

  async getScoreHistory(matchId: string, limit = 60) {
    if (!canPersist()) return [];

    return ScoreSnapshotModel.find({ matchId })
      .sort({ scrapedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 300))
      .lean();
  }

  async getCommentary(matchId: string) {
    return (await cache.get<CommentaryItem[]>(commentaryKey(matchId))) ?? [];
  }
}

function scoreKey(matchId: string) {
  return `score:${matchId}`;
}

function commentaryKey(matchId: string) {
  return `commentary:${matchId}`;
}
