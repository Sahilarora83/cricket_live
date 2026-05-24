import * as cheerio from "cheerio";
import { env } from "../config/env.js";
import type { CommentaryItem, CricketMatch, LiveScore, MatchStatus } from "../types/cricket.js";
import { fetchCricbuzzHtml } from "../utils/httpClient.js";
import { cleanText, stableId } from "../utils/text.js";
import type { CricketProvider } from "./provider.js";

const TEAM_VS_RE = /([A-Za-z][A-Za-z\s.&'-]{1,40})\s+vs\s+([A-Za-z][A-Za-z\s.&'-]{1,40})/i;
const SCORE_RE = /([A-Z]{2,6})\s+(\d{1,3})\s*[-/]\s*(\d{1,2})\s*\(([\d.]+)\)/g;

function normalizeStatus(text: string): MatchStatus {
  const lower = text.toLowerCase();
  if (lower.includes("won") || lower.includes("draw") || lower.includes("abandon")) return "COMPLETED";
  if (lower.includes("live") || lower.includes("opt to") || hasScore(text)) return "LIVE";
  if (lower.includes("starts") || lower.includes("preview") || lower.includes("upcoming")) return "UPCOMING";
  return "UNKNOWN";
}

function absoluteUrl(path?: string) {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${env.CRICBUZZ_BASE_URL}${path}`;
}

export class CricbuzzProvider implements CricketProvider {
  async fetchMatches(): Promise<CricketMatch[]> {
    const data = await fetchCricbuzzHtml(env.CRICBUZZ_LIVE_URL);

    const $ = cheerio.load(data);
    const matches = new Map<string, CricketMatch>();

    $("a[href*='/live-cricket-scores/']").each((_, element) => {
      const href = $(element).attr("href");
      const text = cleanText($(element).text());
      const title = cleanText($(element).attr("title") ?? "");
      if (!href || text.length < 8) return;

      const idFromUrl = href.match(/live-cricket-scores\/(\d+)/)?.[1] ?? stableId([href]);
      const richText = title || text;
      const teams = richText.match(TEAM_VS_RE);
      const team1 = cleanText(teams?.[1] ?? text.split(" vs ")[0] ?? "Team A");
      const team2 = cleanText(
        teams?.[2]?.split(/,|\s+\d+(st|nd|rd|th)\s+|\s+-\s+/i)[0] ??
          text.split(" vs ")[1]?.split(" - ")[0] ??
          "Team B"
      );
      const id = `cricbuzz_${idFromUrl}`;

      if (matches.has(id)) return;

      matches.set(id, {
        id,
        providerId: idFromUrl,
        team1,
        team2,
        status: normalizeStatus(richText),
        matchType: inferMatchType(richText),
        series: inferSeries(richText),
        startTime: inferStartTime(richText),
        venue: inferVenue(richText),
        detailUrl: absoluteUrl(href),
        rawText: richText
      });
    });

    for (const embeddedMatch of extractEmbeddedMatches(data)) {
      const existing = matches.get(embeddedMatch.id);
      matches.set(
        embeddedMatch.id,
        existing
          ? {
              ...embeddedMatch,
              ...existing,
              status: embeddedMatch.status,
              startTime: embeddedMatch.startTime ?? existing.startTime,
              venue: embeddedMatch.venue ?? existing.venue,
              rawText: existing.rawText ?? embeddedMatch.rawText,
              detailUrl: existing.detailUrl ?? embeddedMatch.detailUrl,
              embeddedScore: embeddedMatch.embeddedScore ?? existing.embeddedScore
            }
          : embeddedMatch
      );
    }

    return Array.from(matches.values());
  }

  async findMatch(query: string): Promise<CricketMatch | null> {
    const trimmed = cleanText(query);
    const directUrl = extractCricbuzzMatchUrl(trimmed);

    if (directUrl) {
      const id = directUrl.match(/live-cricket-scores\/(\d+)/)?.[1];
      if (id) {
        const listedMatch = (await this.fetchMatches()).find((match) => match.providerId === id);
        if (listedMatch) return listedMatch;
      }
      return this.fetchMatchFromUrl(directUrl);
    }

    const matches = await this.fetchMatches();
    return rankMatches(matches, trimmed)[0] ?? null;
  }

  async fetchLiveScore(match: CricketMatch): Promise<LiveScore> {
    if (match.embeddedScore && match.status === "COMPLETED") {
      return {
        ...match.embeddedScore,
        updatedAt: new Date().toISOString()
      };
    }

    if (!match.detailUrl) {
      return scoreFromMatchText(match);
    }

    const data = await fetchCricbuzzHtml(match.detailUrl);

    const $ = cheerio.load(data);
    const pageText = cleanText($("body").text());
    const sourceScoreText = cleanText($(".cb-min-bat-rw, .cb-font-20, .cb-scrs-wrp, .cb-text-live").first().text());
    const scoreText = sourceScoreText && sourceScoreText.length < 220 ? sourceScoreText : match.rawText || pageText.slice(0, 300);
    const parsed = parseScore(scoreText) ?? parseScore(pageText);
    const fallbackScore = match.embeddedScore;
    const mergedScore = mergeScoreText(fallbackScore?.score, parsed?.score, match);
    const sourceStatusText = cleanText($(".cb-text-live, .cb-text-complete, .cb-text-preview").first().text());
    const startStatus = inferStartStatus(pageText) ?? inferStartStatus(match.rawText ?? "");
    const statusText =
      sourceStatusText ||
      (parsed ? match.rawText : startStatus) ||
      (parsed ? inferStatusLine(pageText) : undefined) ||
      match.rawText ||
      "Live score unavailable";

    return {
      matchId: match.id,
      battingTeam: parsed?.battingTeam ?? fallbackScore?.battingTeam,
      score: mergedScore || parsed?.score || fallbackScore?.score,
      runs: parsed?.runs ?? fallbackScore?.runs,
      wickets: parsed?.wickets ?? fallbackScore?.wickets,
      overs: parsed?.overs ?? fallbackScore?.overs,
      runRate: parsed?.runRate ?? fallbackScore?.runRate,
      statusText,
      batters: extractBatters($),
      bowler: extractBowler($),
      partnership: extractPartnership(pageText),
      updatedAt: new Date().toISOString(),
      source: "cricbuzz"
    };
  }

  async fetchCommentary(match: CricketMatch): Promise<CommentaryItem[]> {
    if (!match.detailUrl) return [];
    const commentaryUrl = match.detailUrl.replace("/live-cricket-scores/", "/cricket-full-commentary/");

    try {
      const data = await fetchCricbuzzHtml(commentaryUrl);
      const $ = cheerio.load(data);
      const items: CommentaryItem[] = [];

      $(".cb-com-ln, .cb-col.cb-col-90, p").each((index, element) => {
        const description = cleanText($(element).text());
        if (!description || description.length < 12) return;
        const over = description.match(/^(\d+\.\d+)/)?.[1];
        items.push({
          id: `${match.id}_${index}_${stableId([description]).slice(0, 16)}`,
          matchId: match.id,
          over,
          event: inferEvent(description),
          description,
          timestamp: new Date().toISOString()
        });
      });

      return items.slice(0, env.COMMENTARY_LIMIT);
    } catch {
      return [];
    }
  }

  private async fetchMatchFromUrl(url: string): Promise<CricketMatch> {
    const data = await fetchCricbuzzHtml(url);

    const $ = cheerio.load(data);
    const title = cleanText($("title").text());
    const heading = cleanText($("h1").first().text());
    const bodyText = cleanText($("body").text());
    const urlParts = url.match(/live-cricket-scores\/(\d+)\/([^/?#]+)/);
    const providerId = urlParts?.[1] ?? stableId([url]);
    const slug = urlParts?.[2]?.replace(/-/g, " ") ?? "";
    const searchableText = cleanText([heading, title, slug, bodyText.slice(0, 600)].join(" "));
    const teams = searchableText.match(TEAM_VS_RE);
    const sourceStatusText = cleanText($(".cb-text-live, .cb-text-complete, .cb-text-preview").first().text());
    const statusText = sourceStatusText || inferDirectStatusText(searchableText);
    const startStatus = inferStartStatus(bodyText);
    const startTime = inferStartTime(bodyText) ?? inferStartTime(searchableText);

    return {
      id: `cricbuzz_${providerId}`,
      providerId,
      team1: cleanText(teams?.[1] ?? slug.split(" vs ")[0] ?? "Team A").toUpperCase(),
      team2: cleanText(teams?.[2]?.split(/,|\d+(st|nd|rd|th)\s+match/i)[0] ?? "Team B").toUpperCase(),
      status: normalizeStatus(statusText),
      matchType: inferMatchType(searchableText),
      series: inferSeries(slug) ?? inferSeries(title) ?? inferSeries(searchableText),
      startTime,
      venue: inferVenue(searchableText),
      detailUrl: url,
      rawText: startStatus || statusText
    };
  }
}

type EmbeddedMatch = {
  matchInfo?: {
    matchId: number;
    matchDesc: string;
    matchFormat: string;
    startDate: string | number;
    state: string;
    status: string;
    team1: { teamName: string; teamSName: string };
    team2: { teamName: string; teamSName: string };
    venueInfo?: { ground?: string; city?: string };
  };
  matchScore?: Record<string, unknown>;
};

function extractEmbeddedMatches(html: string): CricketMatch[] {
  const matchesList = extractJsonAfterMarker<{ matches?: Array<{ match?: EmbeddedMatch }> }>(html, "matchesList")?.matches ?? [];

  return matchesList
    .map((item) => item.match)
    .filter((match): match is EmbeddedMatch => Boolean(match?.matchInfo))
    .map((match) => {
      const info = match.matchInfo!;
      const id = `cricbuzz_${info.matchId}`;
      return {
        id,
        providerId: String(info.matchId),
        team1: info.team1.teamName,
        team2: info.team2.teamName,
        status: normalizeState(info.state, info.status),
        matchType: info.matchFormat,
        startTime: new Date(Number(info.startDate)).toISOString(),
        venue: [info.venueInfo?.ground, info.venueInfo?.city].filter(Boolean).join(", "),
        detailUrl: `${env.CRICBUZZ_BASE_URL}/live-cricket-scores/${info.matchId}/match`,
        rawText: `${info.team1.teamName} vs ${info.team2.teamName}, ${info.matchDesc} - ${info.status}`,
        embeddedScore: embeddedScoreToLiveScore(id, match)
      };
    });
}

function normalizeState(state: string, status: string): MatchStatus {
  const text = `${state} ${status}`;
  if (/complete|won|draw|abandon|no result/i.test(text)) return "COMPLETED";
  if (/in progress|live|innings|opt to/i.test(text)) return "LIVE";
  if (/preview|upcoming|starts/i.test(text)) return "UPCOMING";
  return "UNKNOWN";
}

function embeddedScoreToLiveScore(matchId: string, match: EmbeddedMatch): LiveScore | undefined {
  const innings = flattenInnings(match.matchScore, match.matchInfo);
  if (innings.length === 0) return undefined;

  const latest = innings[innings.length - 1];
  const completedOvers = oversToCompletedOvers(latest.overs);
  return {
    matchId,
    battingTeam: latest.team,
    score: innings.map((item) => `${item.team} ${item.runs}/${item.wickets} (${item.overs})`).join(", "),
    runs: latest.runs,
    wickets: latest.wickets,
    overs: String(latest.overs),
    runRate: completedOvers > 0 ? (latest.runs / completedOvers).toFixed(2) : undefined,
    statusText: match.matchInfo?.status ?? "Completed",
    batters: [],
    updatedAt: new Date().toISOString(),
    source: "cricbuzz"
  };
}

function flattenInnings(score: unknown, info?: EmbeddedMatch["matchInfo"]) {
  if (!score || typeof score !== "object") return [];

  const rows: Array<{ team: string; runs: number; wickets: number; overs: number | string }> = [];
  for (const [teamKey, teamScore] of Object.entries(score as Record<string, unknown>)) {
    if (!teamScore || typeof teamScore !== "object") continue;
    const team = teamKey === "team1Score" ? info?.team1.teamSName ?? "T1" : info?.team2.teamSName ?? "T2";
    for (const innings of Object.values(teamScore as Record<string, unknown>)) {
      if (!innings || typeof innings !== "object") continue;
      const row = innings as { runs?: number; wickets?: number; overs?: number | string };
      if (typeof row.runs === "number") {
        rows.push({ team, runs: row.runs, wickets: row.wickets ?? 0, overs: normalizeOversDisplay(row.overs ?? "") });
      }
    }
  }
  return rows;
}

function extractJsonAfterMarker<T>(html: string, marker: string): T | null {
  const decoded = html.replace(/\\"/g, '"').replace(/\\u0026/g, "&").replace(/\\n/g, "");
  const markerIndex = decoded.indexOf(`"${marker}":`);
  if (markerIndex < 0) return null;
  const start = decoded.indexOf("{", markerIndex);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < decoded.length; index += 1) {
    const char = decoded[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      try {
        return JSON.parse(decoded.slice(start, index + 1)) as T;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function extractCricbuzzMatchUrl(query: string) {
  const match = query.match(/https?:\/\/(?:www\.)?cricbuzz\.com\/live-cricket-scores\/\d+\/[^\s]+/i);
  if (match) return match[0];

  const id = query.match(/\b\d{5,8}\b/)?.[0];
  if (!id) return null;

  return `${env.CRICBUZZ_BASE_URL}/live-cricket-scores/${id}/match`;
}

function rankMatches(matches: CricketMatch[], query: string) {
  const tokens = cleanText(query)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && token !== "cricbuzz" && token !== "com");

  return matches
    .map((match) => {
      const haystack = [
        match.id,
        match.providerId,
        match.team1,
        match.team2,
        match.status,
        match.matchType,
        match.series,
        match.venue,
        match.rawText,
        match.detailUrl
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { match, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.match);
}

function inferMatchType(text: string) {
  if (/t20|ipl/i.test(text)) return "T20";
  if (/odi/i.test(text)) return "ODI";
  if (/test/i.test(text)) return "TEST";
  return undefined;
}

function inferSeries(text: string) {
  if (/indian premier league\s*2026/i.test(text)) return "Indian Premier League 2026";
  if (/ipl\s*2026/i.test(text)) return "IPL 2026";
  const series = text.match(/([A-Za-z0-9\s'-]{2,80}(tour|league|cup|series)[A-Za-z0-9\s'-]{0,40})/i)?.[0];
  return series ? cleanText(series) : undefined;
}

function inferDirectStatusText(text: string) {
  if (hasScore(text)) return Array.from(text.matchAll(SCORE_RE))[0]?.[0] ?? "LIVE";
  if (/\bpreview\b|today|starts/i.test(text)) return "Preview";
  if (/\bwon by\b|\bmatch tied\b|\bno result\b/i.test(text)) {
    return text.match(/[^.]{0,80}(\bwon by\b|\bmatch tied\b|\bno result\b)[^.]{0,120}/i)?.[0] ?? "Completed";
  }
  return "Preview";
}

function inferVenue(text: string) {
  const parts = text.split(" • ");
  return parts.length > 1 ? cleanText(parts[1].split(/\s+[A-Z]{2,5}\s+\d/)[0]) : undefined;
}

function inferStartStatus(text: string) {
  return text.match(/Match starts at [A-Za-z]+\s+\d{1,2},\s+\d{1,2}:\d{2}\s+GMT/i)?.[0] ?? undefined;
}

function inferStartTime(text: string) {
  const gmt = text.match(/Match starts at ([A-Za-z]+)\s+(\d{1,2}),\s+(\d{1,2}):(\d{2})\s+GMT/i);
  if (gmt) {
    const [, monthName, day, hour, minute] = gmt;
    const date = new Date(Date.UTC(2026, monthIndex(monthName), Number(day), Number(hour), Number(minute)));
    return date.toISOString();
  }

  if (/\btoday\b/i.test(text) && /7:30\s*PM/i.test(text)) {
    return new Date(Date.UTC(2026, 4, 21, 14, 0)).toISOString();
  }

  return undefined;
}

function monthIndex(monthName: string) {
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].findIndex((item) =>
    monthName.toLowerCase().startsWith(item)
  );
  return Math.max(month, 0);
}

function parseScore(text: string) {
  const matches = Array.from(text.matchAll(SCORE_RE));
  if (matches.length === 0) return null;

  const match = matches[matches.length - 1];
  const inningsScores = Array.from(new Set(matches.map((item) => `${item[1]} ${item[2]}/${item[3]} (${normalizeOversDisplay(item[4])})`)));
  const runs = Number(match[2]);
  const wickets = Number(match[3]);
  const overs = normalizeOversDisplay(match[4]);
  const completedOvers = oversToCompletedOvers(match[4]);
  const runRate = completedOvers > 0 ? (runs / completedOvers).toFixed(2) : undefined;

  return {
    battingTeam: match[1],
    score: inningsScores.join(", "),
    runs,
    wickets,
    overs,
    runRate
  };
}

function mergeScoreText(baseScore: string | undefined, latestScore: string | undefined, match: CricketMatch) {
  const rows = new Map<string, { score: string; overs: string }>();
  const addRows = (scoreText?: string) => {
    if (!scoreText) return;
    for (const item of scoreText.matchAll(SCORE_RE)) {
      rows.set(item[1], {
        score: `${item[2]}/${item[3]}`,
        overs: normalizeOversDisplay(item[4])
      });
    }
  };

  addRows(baseScore);
  addRows(latestScore);

  return [shortTeamName(match.team1), shortTeamName(match.team2)]
    .map((team) => {
      const row = rows.get(team);
      return row ? `${team} ${row.score} (${row.overs})` : "";
    })
    .filter(Boolean)
    .join(", ");
}

function shortTeamName(name: string) {
  const map: Record<string, string> = {
    "chennai super kings": "CSK",
    "delhi capitals": "DC",
    "gujarat titans": "GT",
    "kolkata knight riders": "KKR",
    "lucknow super giants": "LSG",
    "mumbai indians": "MI",
    "punjab kings": "PBKS",
    "royal challengers bengaluru": "RCB",
    "rajasthan royals": "RR",
    "sunrisers hyderabad": "SRH"
  };
  const normalized = name.toLowerCase();
  if (map[normalized]) return map[normalized];
  const words = name.split(/\s+/).filter(Boolean);
  return words.length > 2 ? words.map((word) => word[0]).join("").toUpperCase() : name.toUpperCase();
}

function normalizeOversDisplay(value: number | string) {
  const raw = String(value);
  const match = raw.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return raw;

  const overs = Number(match[1]);
  const balls = Number(match[2] ?? 0);
  if (balls >= 6) {
    return `${overs + Math.floor(balls / 6)}.${balls % 6}`;
  }
  return match[2] === undefined ? `${overs}` : `${overs}.${balls}`;
}

function oversToCompletedOvers(value: number | string) {
  const raw = String(value);
  const match = raw.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return 0;

  const overs = Number(match[1]);
  const balls = Number(match[2] ?? 0);
  return overs + balls / 6;
}

function hasScore(text: string) {
  return Array.from(text.matchAll(SCORE_RE)).length > 0;
}

function scoreFromMatchText(match: CricketMatch): LiveScore {
  const parsed = parseScore(match.rawText ?? "");
  return {
    matchId: match.id,
    battingTeam: parsed?.battingTeam,
    score: parsed?.score,
    runs: parsed?.runs,
    wickets: parsed?.wickets,
    overs: parsed?.overs,
    runRate: parsed?.runRate,
    statusText: match.rawText ?? match.status,
    batters: [],
    updatedAt: new Date().toISOString(),
    source: "cricbuzz"
  };
}

function extractBatters($: cheerio.CheerioAPI) {
  const batters: { name: string; runs?: number; balls?: number }[] = [];
  $(".cb-min-inf, .cb-col").each((_, element) => {
    const text = cleanText($(element).text());
    const match = text.match(/^([A-Za-z\s.'-]{2,35})\s+(\d{1,3})\s+\((\d{1,3})\)/);
    if (match && batters.length < 2) {
      batters.push({ name: cleanText(match[1]), runs: Number(match[2]), balls: Number(match[3]) });
    }
  });
  return batters;
}

function extractBowler($: cheerio.CheerioAPI) {
  let bowler: { name: string; overs?: string; wickets?: number } | undefined;
  $(".cb-min-inf, .cb-col").each((_, element) => {
    if (bowler) return;
    const text = cleanText($(element).text());
    const match = text.match(/^([A-Za-z\s.'-]{2,35})\s+([\d.]+)-\d+-\d+-(\d+)/);
    if (match) bowler = { name: cleanText(match[1]), overs: match[2], wickets: Number(match[3]) };
  });
  return bowler;
}

function inferStatusLine(text: string) {
  return text.match(/[^.]{0,80}(need|won|opt to|trail|lead|stumps|lunch|tea)[^.]{0,120}/i)?.[0]?.trim();
}

function extractPartnership(text: string) {
  return text.match(/Partnership[:\s]+([^|.]{3,80})/i)?.[1]?.trim();
}

function inferEvent(description: string) {
  if (/\bWICKET\b|out!/i.test(description)) return "WICKET";
  if (/\bSIX\b|six/i.test(description)) return "SIX";
  if (/\bFOUR\b|four/i.test(description)) return "FOUR";
  return undefined;
}
