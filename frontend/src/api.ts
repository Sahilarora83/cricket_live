import type { CommentaryItem, CricketMatch, IplSeriesData, LiveScore, SystemStatus } from "./types";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const payload = (await response.json()) as { data: T };
  return payload.data;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export const api = {
  matches: () => get<CricketMatch[]>("/api/matches"),
  liveMatch: () => get<CricketMatch | null>("/api/live-match"),
  trackMatch: (query: string) => post<CricketMatch>("/api/track-match", { query }),
  score: (matchId: string) => get<LiveScore | null>(`/api/score/${matchId}`),
  commentary: (matchId: string) => get<CommentaryItem[]>(`/api/commentary/${matchId}`),
  iplSeries: () => get<IplSeriesData>("/api/series/ipl-2026"),
  refreshIplSeries: () => post<IplSeriesData>("/api/series/ipl-2026/refresh", {}),
  systemStatus: () => get<SystemStatus>("/api/system-status")
};

export const socketUrl = import.meta.env.VITE_SOCKET_URL ?? API_URL;
