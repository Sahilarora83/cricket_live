import { MatchModel } from "../models/Match.js";
import { LiveScoreModel } from "../models/LiveScore.js";
import { cache } from "../redis/cache.js";
import type { CricketMatch } from "../types/cricket.js";
import { canPersist } from "../utils/persistence.js";
import type { CricketProvider } from "./provider.js";

const MATCHES_KEY = "matches:all";
const ACTIVE_MATCH_KEY = "match:active";
const MANUAL_ACTIVE_KEY = "match:active:manual";
const IPL_TEAM_NAMES = [
  "chennai super kings",
  "delhi capitals",
  "gujarat titans",
  "kolkata knight riders",
  "lucknow super giants",
  "mumbai indians",
  "punjab kings",
  "royal challengers bengaluru",
  "rajasthan royals",
  "sunrisers hyderabad"
];

export class MatchService {
  constructor(private readonly provider: CricketProvider) {}

  async refreshMatches() {
    const matches = (await this.provider.fetchMatches()).filter(isIplMatch);
    await cache.set(MATCHES_KEY, matches, 120);

    if (canPersist()) {
      await Promise.allSettled(
        matches.map(async (match) => {
          await MatchModel.updateOne(
            { providerId: match.providerId },
            {
              $set: {
                providerId: match.providerId,
                team1: match.team1,
                team2: match.team2,
                status: match.status,
                matchType: match.matchType,
                series: match.series,
                startTime: match.startTime ? new Date(match.startTime) : undefined,
                venue: match.venue,
                detailUrl: match.detailUrl,
                rawText: match.rawText,
                embeddedScore: match.embeddedScore
              }
            },
            { upsert: true }
          );

          if (match.embeddedScore) {
            await LiveScoreModel.updateOne(
              { matchId: match.id },
              {
                $set: {
                  ...match.embeddedScore,
                  scrapedAt: new Date(match.embeddedScore.updatedAt)
                }
              },
              { upsert: true }
            );
          }
        })
      );
    }

    const manualActive = await cache.get<CricketMatch>(MANUAL_ACTIVE_KEY);
    const updatedManualActive = manualActive ? mergeUpdatedMatch(manualActive, matches) : null;
    const active = updatedManualActive ?? selectActiveMatch(matches);
    const previous = await this.getActiveMatch();

    if (active && active.id !== previous?.id) {
      await cache.set(ACTIVE_MATCH_KEY, active);
      return { matches, active, changed: true };
    }

    if (!previous && active) {
      await cache.set(ACTIVE_MATCH_KEY, active);
    }

    return { matches, active: active ?? previous, changed: false };
  }

  async getMatches() {
    const cached = (await cache.get<CricketMatch[]>(MATCHES_KEY)) ?? [];
    if (cached.length > 0) return cached;

    const result = await this.refreshMatches();
    return result.matches;
  }

  async getActiveMatch() {
    return cache.get<CricketMatch>(ACTIVE_MATCH_KEY);
  }

  async trackMatch(query: string) {
    const match = await this.findMatch(query);
    if (!match) return null;

    await cache.set(ACTIVE_MATCH_KEY, match);
    await cache.set(MANUAL_ACTIVE_KEY, match, 60 * 60 * 6);

    const matches = await this.getMatches();
    if (!matches.some((item) => item.id === match.id)) {
      await cache.set(MATCHES_KEY, [match, ...matches], 120);
    }

    return match;
  }

  private async findMatch(query: string) {
    if (this.provider.findMatch) {
      const providerMatch = await this.provider.findMatch(query);
      if (providerMatch) return providerMatch;
    }

    const matches = await this.getMatches();
    return searchCachedMatches(matches, query)[0] ?? null;
  }
}

function selectActiveMatch(matches: CricketMatch[]) {
  return (
    matches.find((match) => match.status === "LIVE") ??
    matches.find((match) => match.status === "UPCOMING") ??
    matches.find((match) => match.status === "COMPLETED") ??
    matches[0] ??
    null
  );
}

function isIplMatch(match: CricketMatch) {
  const text = [
    match.team1,
    match.team2,
    match.series,
    match.matchType,
    match.venue,
    match.rawText,
    match.detailUrl
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes("ipl") || text.includes("indian premier league") || IPL_TEAM_NAMES.some((team) => text.includes(team));
}

function mergeUpdatedMatch(manualActive: CricketMatch, matches: CricketMatch[]) {
  const updated = matches.find((match) => match.id === manualActive.id || match.providerId === manualActive.providerId);
  const merged = updated ? { ...manualActive, ...updated } : manualActive;
  return merged.status === "LIVE" ? merged : null;
}

function searchCachedMatches(matches: CricketMatch[], query: string) {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);

  return matches.filter((match) => {
    const haystack = Object.values(match).filter(Boolean).join(" ").toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}
