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
  batters: { name: string; runs?: number; balls?: number }[];
  bowler?: { name: string; overs?: string; wickets?: number };
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

export interface IplSeriesData {
  seriesId: number;
  seriesName: string;
  matches: Array<{
    matchId: number;
    matchDesc: string;
    format: string;
    state: string;
    status: string;
    startTime: string;
    team1: SeriesTeam;
    team2: SeriesTeam;
    venue?: string;
  }>;
  pointsTable: Array<{
    teamId: number;
    teamName: string;
    shortName: string;
    played: number;
    won: number;
    lost: number;
    noResult: number;
    nrr: string;
    points: number;
    logoUrl?: string;
  }>;
  squads: Array<{
    teamId?: number;
    teamName: string;
    shortName?: string;
    logoUrl?: string;
    players: Array<{ name: string; playerId?: number }>;
  }>;
  assets: Array<{ imageId: number; type: string; sourceUrl: string; localUrl: string }>;
  scrapedAt: string;
}

export interface SeriesTeam {
  teamId: number;
  teamName: string;
  shortName: string;
  imageId?: number;
  logoUrl?: string;
}
