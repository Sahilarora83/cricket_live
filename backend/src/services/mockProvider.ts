import type { CommentaryItem, CricketMatch, LiveScore } from "../types/cricket.js";
import type { CricketProvider } from "./provider.js";

let runs = 126;
let wickets = 3;
let balls = 87;

const match: CricketMatch = {
  id: "mock_ipl_2026_001",
  providerId: "mock_001",
  team1: "CSK",
  team2: "MI",
  status: "LIVE",
  matchType: "T20",
  series: "IPL 2026",
  venue: "Chennai",
  rawText: "CSK vs MI - CSK 126-3 (14.3)"
};

export class MockProvider implements CricketProvider {
  async fetchMatches(): Promise<CricketMatch[]> {
    return [match];
  }

  async findMatch(): Promise<CricketMatch | null> {
    return match;
  }

  async fetchLiveScore(): Promise<LiveScore> {
    balls += 1;
    runs += [0, 1, 2, 4, 6][Math.floor(Math.random() * 5)] ?? 1;
    if (Math.random() > 0.93) wickets += 1;

    const overs = `${Math.floor(balls / 6)}.${balls % 6}`;
    return {
      matchId: match.id,
      innings: "1",
      battingTeam: "CSK",
      score: `${runs}-${wickets} (${overs})`,
      runs,
      wickets,
      overs,
      runRate: (runs / Math.max(1, balls / 6)).toFixed(2),
      statusText: "CSK are building momentum in the middle overs",
      batters: [
        { name: "Ruturaj Gaikwad", runs: 58, balls: 39 },
        { name: "Shivam Dube", runs: 24, balls: 13 }
      ],
      bowler: { name: "Jasprit Bumrah", overs: "3.2", wickets: 1 },
      partnership: "42 runs from 25 balls",
      updatedAt: new Date().toISOString(),
      source: "mock"
    };
  }

  async fetchCommentary(): Promise<CommentaryItem[]> {
    return [
      {
        id: `mock_${balls}`,
        matchId: match.id,
        over: `${Math.floor(balls / 6)}.${balls % 6}`,
        event: runs % 2 === 0 ? "FOUR" : undefined,
        description: runs % 2 === 0 ? "FOUR, cracked through extra cover." : "Driven to long-off for a single.",
        timestamp: new Date().toISOString()
      }
    ];
  }
}
