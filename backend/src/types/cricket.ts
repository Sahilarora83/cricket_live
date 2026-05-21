export type MatchStatus = "LIVE" | "UPCOMING" | "COMPLETED" | "UNKNOWN";

export interface CricketMatch {
  id: string;
  providerId: string;
  team1: string;
  team2: string;
  status: MatchStatus;
  matchType?: string;
  series?: string;
  startTime?: string;
  venue?: string;
  detailUrl?: string;
  rawText?: string;
  embeddedScore?: LiveScore;
}

export interface BatterLine {
  name: string;
  runs?: number;
  balls?: number;
}

export interface BowlerLine {
  name: string;
  overs?: string;
  wickets?: number;
}

export interface LiveScore {
  matchId: string;
  innings?: string;
  battingTeam?: string;
  score?: string;
  runs?: number;
  wickets?: number;
  overs?: string;
  runRate?: string;
  target?: string;
  statusText: string;
  batters: BatterLine[];
  bowler?: BowlerLine;
  partnership?: string;
  updatedAt: string;
  source: "cricbuzz" | "mock";
}

export interface CommentaryItem {
  id: string;
  matchId: string;
  over?: string;
  ball?: string;
  event?: string;
  description: string;
  timestamp: string;
}
