import axios from "axios";
import * as cheerio from "cheerio";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { SeriesSnapshotModel } from "../models/SeriesSnapshot.js";
import { cache } from "../redis/cache.js";
import { canPersist } from "../utils/persistence.js";
import { cleanText, slugify } from "../utils/text.js";

const SERIES_ID = 9241;
const SERIES_NAME = "Indian Premier League 2026";
const SERIES_BASE = "https://www.cricbuzz.com/cricket-series/9241/indian-premier-league-2026";
const SERIES_CACHE_KEY = "series:ipl:2026";
const ASSET_DIR = path.resolve(process.cwd(), "public", "assets", "cricbuzz");

type RawMatch = {
  match?: {
    matchInfo?: {
      matchId: number;
      seriesId: number;
      seriesName: string;
      matchDesc: string;
      matchFormat: string;
      startDate: number;
      endDate?: number;
      state: string;
      status: string;
      team1: RawTeam;
      team2: RawTeam;
      venueInfo?: { ground?: string; city?: string; timezone?: string };
      stateTitle?: string;
      shortStatus?: string;
      matchImageId?: number;
    };
    matchScore?: unknown;
  };
};

type MatchDetailsData = {
  matchDetails?: Array<{
    matchDetailsMap?: {
      key?: string;
      match?: Array<{
        matchInfo?: RawMatch["match"] extends infer M ? M extends { matchInfo?: infer I } ? I : never : never;
        matchScore?: unknown;
      }>;
      seriesId?: number;
    };
  }>;
};

type RawTeam = {
  teamId: number;
  teamName: string;
  teamSName: string;
  imageId?: number;
};

type PointsTeam = {
  teamFullName: string;
  teamName: string;
  teamId: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  noRes: number;
  nrr: string;
  points: number;
  teamImageId?: number;
};

export class SeriesService {
  async refreshIplSeries() {
    const [matchesHtml, pointsHtml, squadsHtml] = await Promise.all([
      fetchPage(`${SERIES_BASE}/matches`),
      fetchPage(`${SERIES_BASE}/points-table`),
      fetchPage(`${SERIES_BASE}/squads`)
    ]);

    const matchesData = extractJsonAfterMarker<MatchDetailsData>(matchesHtml, "matchesData");
    const matchesListFromSchedule = flattenSeriesMatches(matchesData);
    const matchesList = matchesListFromSchedule.length
      ? matchesListFromSchedule
      : extractJsonAfterMarker<{ matches?: RawMatch[] }>(matchesHtml, "matchesList")?.matches ?? [];
    const pointsData = extractJsonAfterMarker<{ pointsTable?: { pointsTableInfo?: PointsTeam[] }[] }>(pointsHtml, "pointsTableData");
    const pointRows = pointsData?.pointsTable?.flatMap((group) => group.pointsTableInfo ?? []) ?? [];
    const teamLogoMap = buildTeamLogoMap(matchesList, pointRows);

    const matches = matchesList
      .map((item) => item.match?.matchInfo)
      .filter((match): match is NonNullable<NonNullable<RawMatch["match"]>["matchInfo"]> => {
        if (!match) return false;
        return match.seriesId === SERIES_ID;
      })
      .map((match) => ({
        matchId: match.matchId,
        matchDesc: match.matchDesc,
        format: match.matchFormat,
        state: match.state,
        status: match.status,
        startTime: toIso(match.startDate),
        endTime: match.endDate ? toIso(match.endDate) : undefined,
        team1: normalizeTeam(match.team1),
        team2: normalizeTeam(match.team2),
        venue: [match.venueInfo?.ground, match.venueInfo?.city].filter(Boolean).join(", "),
        matchImageId: match.matchImageId,
        matchImageUrl: match.matchImageId ? imageUrl(match.matchImageId, "290x160") : undefined,
        score: matchesList.find((item) => item.match?.matchInfo?.matchId === match.matchId)?.match?.matchScore
      }));

    const pointsTable = pointRows.map((row) => ({
      teamId: row.teamId,
      teamName: row.teamFullName,
      shortName: row.teamName,
      played: row.matchesPlayed,
      won: row.matchesWon,
      lost: row.matchesLost,
      noResult: row.noRes,
      nrr: row.nrr,
      points: row.points,
      imageId: row.teamImageId ?? teamLogoMap.get(row.teamId)?.imageId,
      logoUrl: localAssetPath(row.teamImageId ?? teamLogoMap.get(row.teamId)?.imageId)
    }));

    const squads = extractSquadTeams(squadsHtml).map((teamName) => {
      const logo = Array.from(teamLogoMap.values()).find((team) => team.teamName === teamName);
      return {
        teamId: logo?.teamId,
        teamName,
        shortName: logo?.teamSName,
        imageId: logo?.imageId,
        logoUrl: localAssetPath(logo?.imageId),
        players: extractTaggedPlayersForTeam(squadsHtml, teamName)
      };
    });

    const photoIds = collectPhotoImageIds([matchesHtml, pointsHtml, squadsHtml], teamLogoMap);
    const assets = collectAssets(matches, pointsTable, squads, photoIds);
    const downloadedAssets = await downloadAssets(assets);

    const snapshot = {
      seriesId: SERIES_ID,
      seriesName: SERIES_NAME,
      matches,
      pointsTable,
      squads,
      assets: downloadedAssets,
      scrapedAt: new Date().toISOString()
    };

    await cache.set(SERIES_CACHE_KEY, snapshot, 60 * 10);

    if (canPersist()) {
      await SeriesSnapshotModel.updateOne(
        { seriesId: SERIES_ID },
        { $set: { ...snapshot, scrapedAt: new Date(snapshot.scrapedAt) } },
        { upsert: true }
      );
    }

    return snapshot;
  }

  async getIplSeries() {
    const cached = await cache.get<Awaited<ReturnType<SeriesService["refreshIplSeries"]>>>(SERIES_CACHE_KEY);
    if (cached) return cached;

    if (canPersist()) {
      const stored = await SeriesSnapshotModel.findOne({ seriesId: SERIES_ID }).lean();
      if (stored) return stored;
    }

    return this.refreshIplSeries();
  }
}

async function fetchPage(url: string) {
  const { data } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0 cricket-live-system/1.0" },
    timeout: 15000
  });
  return String(data);
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

function normalizeTeam(team: RawTeam) {
  return {
    teamId: team.teamId,
    teamName: team.teamName,
    shortName: team.teamSName,
    imageId: team.imageId,
    logoUrl: localAssetPath(team.imageId)
  };
}

function toIso(value: number | string) {
  return new Date(Number(value)).toISOString();
}

function flattenSeriesMatches(matchesData: MatchDetailsData | null): RawMatch[] {
  return (
    matchesData?.matchDetails?.flatMap((detail) =>
      detail.matchDetailsMap?.match?.map((match) => ({
        match: {
          matchInfo: match.matchInfo,
          matchScore: match.matchScore
        }
      })) ?? []
    ) ?? []
  );
}

function buildTeamLogoMap(matchesList: RawMatch[], pointRows: PointsTeam[]) {
  const teams = new Map<number, RawTeam>();

  for (const row of pointRows) {
    teams.set(row.teamId, {
      teamId: row.teamId,
      teamName: row.teamFullName,
      teamSName: row.teamName,
      imageId: row.teamImageId
    });
  }

  for (const item of matchesList) {
    const info = item.match?.matchInfo;
    if (!info) continue;
    teams.set(info.team1.teamId, info.team1);
    teams.set(info.team2.teamId, info.team2);
  }

  return teams;
}

function extractSquadTeams(html: string) {
  const $ = cheerio.load(html);
  const teams = new Set<string>();
  $("h2:contains('SQUADS'), h2:contains('Squads')")
    .parent()
    .find("span")
    .each((_, element) => {
      const text = cleanText($(element).text());
      if (text && !/Move to Top|T20/i.test(text)) teams.add(text);
    });

  if (teams.size === 0) {
    const fallback = [
      "Chennai Super Kings",
      "Delhi Capitals",
      "Gujarat Titans",
      "Royal Challengers Bengaluru",
      "Punjab Kings",
      "Kolkata Knight Riders",
      "Sunrisers Hyderabad",
      "Rajasthan Royals",
      "Lucknow Super Giants",
      "Mumbai Indians"
    ];
    fallback.forEach((team) => {
      if (html.includes(team)) teams.add(team);
    });
  }

  return Array.from(teams);
}

function extractTaggedPlayersForTeam(html: string, teamName: string) {
  const decoded = html.replace(/\\"/g, '"').replace(/\\u0026/g, "&");
  const players = new Map<string, { playerId?: number; name: string }>();
  const teamTag = `"itemName":"${teamName}","itemType":"team"`;
  const chunks = decoded.split(teamTag);

  for (const chunk of chunks.slice(1)) {
    const nearby = chunk.slice(0, 1600);
    for (const match of nearby.matchAll(/"itemName":"([^"]+)","itemType":"player","itemId":"?(\d+)"?/g)) {
      players.set(match[1], { name: match[1], playerId: Number(match[2]) });
    }
  }

  return Array.from(players.values());
}

function collectAssets(
  matches: Array<{ matchImageId?: number; team1: { imageId?: number }; team2: { imageId?: number } }>,
  pointsTable: Array<{ imageId?: number }>,
  squads: Array<{ imageId?: number }>,
  photoIds: number[]
) {
  const assets = new Map<number, { imageId: number; type: "team-logo" | "match-photo" | "series-photo"; sourceUrl: string; localUrl: string }>();

  for (const match of matches) {
    for (const imageId of [match.team1.imageId, match.team2.imageId]) {
      if (imageId) assets.set(imageId, { imageId, type: "team-logo", sourceUrl: imageUrl(imageId, "152x152"), localUrl: localAssetPath(imageId) ?? "" });
    }
    if (match.matchImageId) {
      assets.set(match.matchImageId, {
        imageId: match.matchImageId,
        type: "match-photo",
        sourceUrl: imageUrl(match.matchImageId, "290x160"),
        localUrl: localAssetPath(match.matchImageId) ?? ""
      });
    }
  }

  for (const row of pointsTable) {
    if (row.imageId) assets.set(row.imageId, { imageId: row.imageId, type: "team-logo", sourceUrl: imageUrl(row.imageId, "152x152"), localUrl: localAssetPath(row.imageId) ?? "" });
  }

  for (const squad of squads) {
    if (squad.imageId) assets.set(squad.imageId, { imageId: squad.imageId, type: "team-logo", sourceUrl: imageUrl(squad.imageId, "152x152"), localUrl: localAssetPath(squad.imageId) ?? "" });
  }

  for (const imageId of photoIds) {
    if (!assets.has(imageId)) {
      assets.set(imageId, {
        imageId,
        type: "series-photo",
        sourceUrl: imageUrl(imageId, "290x160"),
        localUrl: `/assets/cricbuzz/series-photo-${imageId}.jpg`
      });
    }
  }

  return Array.from(assets.values());
}

function collectPhotoImageIds(htmlPages: string[], teamLogoMap: Map<number, RawTeam>) {
  const teamImageIds = new Set(Array.from(teamLogoMap.values()).map((team) => team.imageId).filter(Boolean));
  const ids = new Set<number>();

  for (const html of htmlPages) {
    const decoded = html.replace(/\\"/g, '"');
    for (const match of decoded.matchAll(/"imageId":"?(\d{5,7})"?/g)) {
      const imageId = Number(match[1]);
      if (!teamImageIds.has(imageId)) ids.add(imageId);
    }
  }

  return Array.from(ids).slice(0, 24);
}

async function downloadAssets(assets: Array<{ imageId: number; type: string; sourceUrl: string; localUrl: string }>) {
  await mkdir(ASSET_DIR, { recursive: true });

  const results = await Promise.allSettled(
    assets.map(async (asset) => {
      const extension = asset.type === "team-logo" ? "png" : "jpg";
      const filename = `${asset.type}-${asset.imageId}.${extension}`;
      const filePath = path.join(ASSET_DIR, filename);
      const response = await axios.get(asset.sourceUrl, { responseType: "arraybuffer", timeout: 15000 });
      await writeFile(filePath, Buffer.from(response.data));
      return { ...asset, localUrl: `/assets/cricbuzz/${filename}` };
    })
  );

  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

function imageUrl(imageId?: number, size = "152x152") {
  return imageId ? `https://static.cricbuzz.com/a/img/v1/${size}/i1/c${imageId}/i.jpg?p=det` : "";
}

function localAssetPath(imageId?: number) {
  return imageId ? `/assets/cricbuzz/team-logo-${imageId}.png` : undefined;
}
