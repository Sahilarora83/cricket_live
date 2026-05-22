import React from "react";
import { createRoot } from "react-dom/client";
import { Bell, CalendarClock, Radio, RefreshCcw, Trophy, Wifi } from "lucide-react";
import { io } from "socket.io-client";
import { API_URL, api, socketUrl } from "./api";
import type { CommentaryItem, CricketMatch, IplSeriesData, LiveScore, SystemStatus } from "./types";
import "./styles.css";

const socket = io(socketUrl, { transports: ["websocket", "polling"] });

const IPL_TEAM_LOGOS: Record<string, string> = {
  csk: "/assets/cricbuzz/team-logo-860038.png",
  "chennai super kings": "/assets/cricbuzz/team-logo-860038.png",
  dc: "/assets/cricbuzz/team-logo-860040.png",
  "delhi capitals": "/assets/cricbuzz/team-logo-860040.png",
  gt: "/assets/cricbuzz/team-logo-860068.png",
  "gujarat titans": "/assets/cricbuzz/team-logo-860068.png",
  kkr: "/assets/cricbuzz/team-logo-860046.png",
  "kolkata knight riders": "/assets/cricbuzz/team-logo-860046.png",
  lsg: "/assets/cricbuzz/team-logo-882545.png",
  "lucknow super giants": "/assets/cricbuzz/team-logo-882545.png",
  mi: "/assets/cricbuzz/team-logo-860053.png",
  "mumbai indians": "/assets/cricbuzz/team-logo-860053.png",
  pbks: "/assets/cricbuzz/team-logo-860084.png",
  "punjab kings": "/assets/cricbuzz/team-logo-860084.png",
  rcb: "/assets/cricbuzz/team-logo-860056.png",
  "royal challengers bengaluru": "/assets/cricbuzz/team-logo-860056.png",
  rr: "/assets/cricbuzz/team-logo-860055.png",
  "rajasthan royals": "/assets/cricbuzz/team-logo-860055.png",
  srh: "/assets/cricbuzz/team-logo-860066.png",
  "sunrisers hyderabad": "/assets/cricbuzz/team-logo-860066.png"
};

const IPL_TEAM_SHORT_NAMES: Record<string, string> = {
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
const IPL_TEAM_NAMES = Object.keys(IPL_TEAM_SHORT_NAMES);

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

function App() {
  const [matches, setMatches] = React.useState<CricketMatch[]>([]);
  const [activeMatch, setActiveMatch] = React.useState<CricketMatch | null>(null);
  const [score, setScore] = React.useState<LiveScore | null>(null);
  const [commentary, setCommentary] = React.useState<CommentaryItem[]>([]);
  const [connected, setConnected] = React.useState(socket.connected);
  const [lastUpdate, setLastUpdate] = React.useState<string>("Waiting for feed");
  const [scorePulse, setScorePulse] = React.useState(0);
  const [seriesData, setSeriesData] = React.useState<IplSeriesData | null>(null);
  const [systemStatus, setSystemStatus] = React.useState<SystemStatus | null>(null);
  const activeMatchId = React.useRef<string | null>(null);

  const showScore = React.useCallback((nextScore: LiveScore | null) => {
    setScore(nextScore);
    if (nextScore?.score) {
      setScorePulse((current) => current + 1);
    }
  }, []);

  React.useEffect(() => {
    activeMatchId.current = activeMatch?.id ?? null;
  }, [activeMatch?.id]);

  React.useEffect(() => {
    let mounted = true;

    async function boot() {
      const [matchList, live] = await Promise.all([api.matches(), api.liveMatch()]);
      if (!mounted) return;
      const iplMatches = matchList.filter(isIplMatch);
      const iplLive = live && isIplMatch(live) ? live : null;
      setMatches(iplMatches);
      setActiveMatch(iplLive ?? iplMatches[0] ?? null);
    }

    void boot();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    void api.iplSeries().then(setSeriesData).catch(() => setSeriesData(null));
  }, []);

  React.useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      try {
        const nextStatus = await api.systemStatus();
        if (mounted) setSystemStatus(nextStatus);
      } catch {
        if (mounted) setSystemStatus(null);
      }
    }

    void loadStatus();
    const timer = window.setInterval(() => void loadStatus(), 30000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  React.useEffect(() => {
    if (!activeMatch) return;
    socket.emit("join_match", activeMatch.id);

    if (activeMatch.status === "COMPLETED" && activeMatch.embeddedScore) {
      showScore(activeMatch.embeddedScore);
      setCommentary([]);
      return () => {
        socket.emit("leave_match", activeMatch.id);
      };
    }

    void Promise.all([api.score(activeMatch.id), api.commentary(activeMatch.id)]).then(([nextScore, nextCommentary]) => {
      showScore(nextScore ?? activeMatch.embeddedScore ?? null);
      setCommentary(nextCommentary);
    });

    return () => {
      socket.emit("leave_match", activeMatch.id);
    };
  }, [activeMatch?.id, showScore]);

  React.useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("matches_update", (payload: CricketMatch[]) => {
      const iplMatches = payload.filter(isIplMatch);
      setMatches(iplMatches);
      void api.liveMatch().then((match) => {
        if (match && isIplMatch(match) && match.id !== activeMatchId.current) {
          setActiveMatch(match);
          showScore(null);
          setCommentary([]);
        }
      });
    });
    socket.on("match_changed", (payload: CricketMatch) => {
      if (!isIplMatch(payload)) return;
      setActiveMatch(payload);
      showScore(null);
      setCommentary([]);
    });
    socket.on("score_update", (payload: LiveScore) => {
      if (activeMatchId.current && payload.matchId !== activeMatchId.current) return;
      showScore(payload);
      setLastUpdate(new Date(payload.updatedAt).toLocaleTimeString());
    });
    socket.on("commentary_update", (payload: { matchId: string; commentary: CommentaryItem[] }) => {
      if (activeMatchId.current && payload.matchId !== activeMatchId.current) return;
      setCommentary(payload.commentary);
    });

    return () => {
      socket.removeAllListeners();
    };
  }, [showScore]);

  const liveMatches = matches.filter((match) => match.status === "LIVE");
  const upcomingMatches = matches.filter((match) => match.status === "UPCOMING");
  const completedMatches = matches.filter((match) => match.status === "COMPLETED");

  async function selectMatch(match: CricketMatch) {
    setActiveMatch(match);
    showScore(match.embeddedScore ?? null);
    setCommentary([]);

    if (match.status !== "COMPLETED" && (match.detailUrl || match.providerId)) {
      try {
        const tracked = await api.trackMatch(match.detailUrl ?? match.providerId);
        setActiveMatch(tracked);
        showScore(tracked.embeddedScore ?? match.embeddedScore ?? null);
      } catch {
        // Keep local selection if tracking a historical card fails.
      }
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Cricket live command</p>
          <h1>{activeMatch ? `${activeMatch.team1} vs ${activeMatch.team2}` : "Finding live matches"}</h1>
        </div>
        <div className="status-stack">
          <span className={connected ? "pill online" : "pill offline"}>
            <Wifi size={16} />
            {connected ? "Online" : "Connecting"}
          </span>
          <span className="pill">
            <RefreshCcw size={16} />
            {lastUpdate}
          </span>
        </div>
      </header>

      <section className="grid">
        <aside className="match-rail">
          <RailSection title="Live" icon={<Radio size={17} />} matches={liveMatches} activeId={activeMatch?.id} onPick={selectMatch} />
          <RailSection title="Upcoming" icon={<CalendarClock size={17} />} matches={upcomingMatches} activeId={activeMatch?.id} onPick={selectMatch} />
          <RailSection title="Recent" icon={<Trophy size={17} />} matches={completedMatches} activeId={activeMatch?.id} onPick={selectMatch} />
        </aside>

        <section className="score-stage">
          <ScorePanel match={activeMatch} score={score} pulseKey={scorePulse} />
          <InsightStrip score={score} match={activeMatch} systemStatus={systemStatus} />
        </section>
      </section>

      <SeriesPanel data={seriesData} onRefresh={() => api.refreshIplSeries().then(setSeriesData)} />
    </main>
  );
}

function RailSection(props: {
  title: string;
  icon: React.ReactNode;
  matches: CricketMatch[];
  activeId?: string;
  onPick: (match: CricketMatch) => void;
}) {
  return (
    <section className="rail-section">
      <div className="panel-heading compact">
        {props.icon}
        <h2>{props.title}</h2>
        <span>{props.matches.length}</span>
      </div>
      <div className="match-list">
        {props.matches.length === 0 ? (
          <p className="muted small">No matches</p>
        ) : (
          props.matches.map((match) => (
            <button
              className={match.id === props.activeId ? "match-card active" : "match-card"}
              key={match.id}
              onClick={() => props.onPick(match)}
            >
              <span className={`dot ${match.status.toLowerCase()}`} />
              <strong>{match.team1} vs {match.team2}</strong>
              <small>{match.matchType ?? "Cricket"} {match.venue ? `- ${match.venue}` : ""}</small>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function ScorePanel({ match, score, pulseKey }: { match: CricketMatch | null; score: LiveScore | null; pulseKey: number }) {
  const isUpcoming = match?.status === "UPCOMING" && !score?.score;
  const hasPlayers = Boolean(score?.batters?.length || score?.bowler);
  const team1Logo = match ? teamLogo(match.team1) : null;
  const team2Logo = match ? teamLogo(match.team2) : null;

  return (
    <section className="score-panel" data-pulse={pulseKey}>
      <div className="score-meta">
        <span className="live-chip">
          <span className="pulse" />
          {match?.status ?? "SYNC"}
        </span>
        <span>{match?.matchType ?? "All formats"}</span>
        <span>{score?.source ?? "source"}</span>
      </div>
      {isUpcoming ? (
        <PreMatchPanel match={match} />
      ) : (
        <>
          {match ? (
            <div className="team-score-strip">
              <TeamBadge name={match.team1} logo={team1Logo} />
              <span>vs</span>
              <TeamBadge name={match.team2} logo={team2Logo} align="right" />
            </div>
          ) : null}
          <div className="scoreline">
            <div>
              <p className="batting-team">{score?.battingTeam ?? match?.team1 ?? "Team"}</p>
              <h2 key={pulseKey}>{score?.score ?? "--"}</h2>
            </div>
            <div className="rate-box">
              <span>RR</span>
              <strong>{score?.runRate ?? "--"}</strong>
            </div>
          </div>
          <p className="status-text">{score?.statusText ?? match?.rawText ?? "Waiting for the next score update."}</p>
        </>
      )}
      {!isUpcoming ? (
        <div className="mini-grid">
          <Metric label="Overs" value={score?.overs ?? "--"} />
          <Metric label="Run rate" value={score?.runRate ?? "--"} />
          <Metric label="Result" value={match?.status === "COMPLETED" ? "Final" : "Live"} />
        </div>
      ) : null}
      {hasPlayers ? (
        <div className="players">
          <div>
            <h3>Batters</h3>
            {score?.batters?.length ? score.batters.map((batter) => (
              <p key={batter.name}>{batter.name} <strong>{batter.runs ?? 0}</strong> <span>({batter.balls ?? 0})</span></p>
            )) : null}
          </div>
          <div>
            <h3>Bowler</h3>
            {score?.bowler ? (
              <p>{score.bowler.name} <strong>{score.bowler.wickets ?? 0} wk</strong> <span>{score.bowler.overs ?? ""} ov</span></p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TeamBadge({ name, logo, align }: { name: string; logo: string | null; align?: "right" }) {
  return (
    <div className={align === "right" ? "team-badge right" : "team-badge"}>
      {logo ? <img src={assetUrl(logo)} alt="" /> : <span className="team-logo-fallback">{shortTeamName(name)}</span>}
      <strong>{shortTeamName(name)}</strong>
    </div>
  );
}

function PreMatchPanel({ match }: { match: CricketMatch }) {
  const startTime = match.startTime ? new Date(match.startTime) : null;
  const startLabel = startTime
    ? startTime.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })
    : "Start time pending";

  return (
    <div className="pre-match">
      <p className="batting-team">Next match</p>
      <h2>No live score yet</h2>
      <p className="status-text">{match.rawText ?? "Match has not started yet."}</p>
      <div className="start-box">
        <span>Starts</span>
        <strong>{startLabel}</strong>
      </div>
    </div>
  );
}

function InsightStrip({
  score,
  match,
  systemStatus
}: {
  score: LiveScore | null;
  match: CricketMatch | null;
  systemStatus: SystemStatus | null;
}) {
  const alertText = match?.status === "UPCOMING" ? "Will switch when Cricbuzz goes live" : "Auto feed enabled";
  const scoreJob = systemStatus?.jobs.scoreUpdater;
  const feedText = scoreJob?.ok ? "Feed healthy" : scoreJob?.lastError ? `Feed retrying: ${scoreJob.lastError}` : "Provider feed";

  return (
    <section className="insight-strip">
      <div>
        <Bell size={18} />
        <span>{alertText}</span>
      </div>
      <div className={scoreJob?.ok === false ? "feed-warning" : ""}>{feedText}</div>
      <div>{score?.updatedAt ? new Date(score.updatedAt).toLocaleString() : "No score yet"}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SeriesPanel({ data, onRefresh }: { data: IplSeriesData | null; onRefresh: () => Promise<unknown> }) {
  const [refreshing, setRefreshing] = React.useState(false);
  const nextMatches = data?.matches.filter((match) => match.state !== "Complete").slice(0, 5) ?? [];

  async function refresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="series-panel">
      <div className="series-heading">
        <div>
          <p className="eyebrow">IPL scraper</p>
          <h2>{data?.seriesName ?? "Indian Premier League 2026"}</h2>
        </div>
        <button type="button" onClick={refresh} disabled={refreshing}>
          <RefreshCcw size={16} />
          {refreshing ? "Scraping" : "Refresh"}
        </button>
      </div>

      <div className="series-grid">
        <div>
          <h3>Points table</h3>
          <div className="points-table">
            {(data?.pointsTable ?? []).map((team, index) => (
              <div className="points-row" key={team.teamId}>
                <span>{index + 1}</span>
                {team.logoUrl ? <img src={assetUrl(team.logoUrl)} alt="" /> : null}
                <strong>{team.shortName}</strong>
                <small>{team.won}-{team.lost}</small>
                <b>{team.points}</b>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3>Upcoming matches</h3>
          <div className="series-list">
            {nextMatches.map((match) => (
              <article key={match.matchId}>
                <strong>{match.team1.shortName} vs {match.team2.shortName}</strong>
                <span>{match.matchDesc} - {new Date(match.startTime).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                <small>{match.venue}</small>
              </article>
            ))}
          </div>
        </div>

        <div>
          <h3>Squads and logos</h3>
          <div className="squad-logos">
            {(data?.squads ?? []).map((team) => (
              <div key={team.teamName} title={team.teamName}>
                {team.logoUrl ? <img src={assetUrl(team.logoUrl)} alt="" /> : null}
                <span>{team.shortName ?? team.teamName}</span>
              </div>
            ))}
          </div>
          <p className="muted small">{data ? `${data.assets.length} assets downloaded locally` : "Scraping series assets..."}</p>
        </div>
      </div>
    </section>
  );
}

function assetUrl(path: string) {
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}

function teamLogo(name: string) {
  return IPL_TEAM_LOGOS[name.toLowerCase()] ?? IPL_TEAM_LOGOS[shortTeamName(name).toLowerCase()] ?? null;
}

function shortTeamName(name: string) {
  const normalized = name.toLowerCase();
  if (IPL_TEAM_SHORT_NAMES[normalized]) return IPL_TEAM_SHORT_NAMES[normalized];

  const known = Object.entries(IPL_TEAM_LOGOS).find(([key]) => key === name.toLowerCase());
  if (known && known[0].length <= 4) return known[0].toUpperCase();

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return name;
  return words.map((word) => word[0]).join("").toUpperCase();
}

createRoot(document.getElementById("root")!).render(<App />);
