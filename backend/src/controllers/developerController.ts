import type { Request, Response } from "express";
import type { ApiKeyService } from "../services/apiKeyService.js";

export class DeveloperController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  getApiKeyPortal = (_request: Request, response: Response) => {
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:"
    );
    response.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cricket Live API Key</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #f6f7f3; color: #14211d; display: grid; place-items: center; padding: 24px; }
      main { width: min(760px, 100%); background: #fff; border: 1px solid #dfe5dc; border-radius: 10px; box-shadow: 0 18px 50px rgba(24, 40, 33, .08); padding: 26px; }
      h1 { font-size: clamp(1.6rem, 4vw, 2.3rem); margin: 0 0 10px; }
      p { color: #53625c; line-height: 1.55; margin: 0 0 20px; }
      form { display: grid; gap: 12px; margin: 22px 0; }
      label { display: grid; gap: 6px; font-weight: 650; }
      input, textarea { border: 1px solid #d9e1d7; border-radius: 8px; font: inherit; padding: 12px; width: 100%; }
      button { background: #0b8f5a; border: 0; border-radius: 8px; color: #fff; cursor: pointer; font: inherit; font-weight: 700; min-height: 44px; padding: 0 16px; }
      button.secondary { background: #132820; }
      button:disabled { cursor: wait; opacity: .7; }
      .result { background: #f8faf6; border: 1px solid #dfe5dc; border-radius: 8px; display: none; gap: 12px; margin-top: 18px; padding: 16px; }
      .result.visible { display: grid; }
      code, textarea { color: #10231b; }
      textarea { min-height: 86px; resize: vertical; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; }
      .status { border-left: 4px solid #db8d1b; padding-left: 12px; }
      .ok { border-color: #0b8f5a; color: #0b633f; }
      .bad { border-color: #b42318; color: #8d1f17; }
    </style>
  </head>
  <body>
    <main>
      <h1>Cricket Live Developer API</h1>
      <p>Generate a random open-source API key and use it in your app with the <code>x-api-key</code> header.</p>

      <form id="keyForm">
        <label>
          App name
          <input name="name" placeholder="My cricket app" required />
        </label>
        <label>
          Email
          <input name="email" type="email" placeholder="developer@example.com" required />
        </label>
        <button type="submit">Generate API key</button>
      </form>

      <section id="result" class="result">
        <strong>Your API key</strong>
        <textarea id="apiKey" readonly></textarea>
        <p class="status">Copy it now. The full key is shown only once.</p>
        <div class="actions">
          <button id="copyBtn" type="button" class="secondary">Copy key</button>
          <button id="testBtn" type="button">Test key</button>
        </div>
        <p id="testStatus" class="status"></p>
        <strong>Example</strong>
        <textarea id="example" readonly></textarea>
      </section>
    </main>

    <script>
      const form = document.getElementById("keyForm");
      const result = document.getElementById("result");
      const apiKeyBox = document.getElementById("apiKey");
      const exampleBox = document.getElementById("example");
      const testStatus = document.getElementById("testStatus");
      let currentKey = "";

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button");
        button.disabled = true;
        button.textContent = "Generating...";
        testStatus.textContent = "";

        try {
          const formData = new FormData(form);
          const response = await fetch("/api/developer/api-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: formData.get("name"),
              email: formData.get("email")
            })
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Could not generate API key");

          currentKey = payload.data.key;
          apiKeyBox.value = currentKey;
          exampleBox.value = '<div id="cricket-live-widget"></div>\\n<script src="' + location.origin + '/api/developer/widget.js" data-api-key="' + currentKey + '" data-target="cricket-live-widget" data-refresh="30000"><\\/script>';
          result.classList.add("visible");
        } catch (error) {
          testStatus.className = "status bad";
          testStatus.textContent = error.message || "Could not generate API key";
        } finally {
          button.disabled = false;
          button.textContent = "Generate API key";
        }
      });

      document.getElementById("copyBtn").addEventListener("click", async () => {
        await navigator.clipboard.writeText(currentKey);
      });

      document.getElementById("testBtn").addEventListener("click", async () => {
        testStatus.className = "status";
        testStatus.textContent = "Testing...";
        try {
          const response = await fetch("/api/v1/live-match", { headers: { "x-api-key": currentKey } });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Test failed");
          testStatus.className = "status ok";
          testStatus.textContent = "Working. Latest match: " + (payload.data ? payload.data.team1 + " vs " + payload.data.team2 : "No live match right now");
        } catch (error) {
          testStatus.className = "status bad";
          testStatus.textContent = error.message || "Test failed";
        }
      });
    </script>
  </body>
</html>`);
  };

  getWidgetScript = (_request: Request, response: Response) => {
    response.type("application/javascript").send(`(() => {
  const script = document.currentScript;
  const apiKey = script?.dataset.apiKey || "";
  const targetId = script?.dataset.target || "";
  const refreshMs = Math.max(Number(script?.dataset.refresh || 30000), 10000);
  const apiBase = new URL(script?.src || location.href).origin;
  const mount = targetId ? document.getElementById(targetId) : null;
  const host = mount || document.createElement("div");

  if (!mount && script?.parentNode) {
    script.parentNode.insertBefore(host, script.nextSibling);
  }

  const root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
  const state = { timer: 0, tab: "live", matches: [], match: null, score: null };

  function styles() {
    return '<style>' +
      ':host{display:block;max-width:440px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17231f}' +
      '.card{border:1px solid #16843f;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 10px 28px rgba(24,40,33,.08)}' +
      '.head{align-items:center;background:#243b82;color:#fff;display:flex;gap:10px;padding:12px 14px}' +
      '.brand{font-size:17px;font-weight:700}.head .live{margin-left:auto}.tabs{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid #dfe5dc}' +
      '.tabs button{background:#fff;border:0;color:#14211d;cursor:pointer;font:inherit;font-weight:650;padding:10px 6px;text-align:center}.tabs .active{background:#078533;color:#fff}' +
      '.body{padding:14px}.teams{align-items:center;display:grid;gap:10px;grid-template-columns:1fr 1fr}.team{display:grid;gap:6px;justify-items:center;text-align:center}' +
      '.logo{background:#f7f8f4;border:1px solid #e2e7df;border-radius:8px;height:44px;object-fit:contain;padding:5px;width:44px}' +
      '.fallback{align-items:center;display:flex;justify-content:center;color:#6b4b2e;font-weight:800}.score{font-size:20px;font-weight:750}.overs{color:#6d7974;font-size:13px}.name{font-weight:750}' +
      '.result{font-weight:750;margin-top:12px;text-align:center}.meta{color:#68756f;font-size:13px;margin-top:6px;text-align:center}.list{display:grid;gap:8px}.row{border-bottom:1px solid #e5ebe2;display:grid;gap:5px;padding:8px 0}.row:last-child{border-bottom:0}.row-main{align-items:center;display:grid;gap:8px;grid-template-columns:30px 1fr auto 1fr 30px}.mini{height:26px;width:26px}.scoreline{font-weight:800;text-align:center}.won{color:#078533;font-weight:800}.small{color:#68756f;font-size:12px;line-height:1.35}.right{text-align:right}.empty{color:#68756f;padding:16px;text-align:center}.foot{align-items:center;border-top:1px solid #e5ebe2;color:#68756f;display:flex;font-size:12px;justify-content:space-between;padding:8px 12px}' +
      '.live{color:#078533;font-weight:800}.error{color:#a32016}.loading{color:#68756f;padding:18px;text-align:center}' +
      '</style>';
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function shortName(name) {
    const map = {
      "chennai super kings": "CSK", "delhi capitals": "DC", "gujarat titans": "GT",
      "kolkata knight riders": "KKR", "lucknow super giants": "LSG", "mumbai indians": "MI",
      "punjab kings": "PBKS", "royal challengers bengaluru": "RCB", "rajasthan royals": "RR",
      "sunrisers hyderabad": "SRH"
    };
    const normalized = String(name || "").toLowerCase();
    if (map[normalized]) return map[normalized];
    const words = String(name || "Team").split(/\\s+/).filter(Boolean);
    return words.length > 2 ? words.map((word) => word[0]).join("").toUpperCase() : String(name || "Team");
  }

  function logoFor(name) {
    const map = {
      csk: "/assets/cricbuzz/team-logo-860038.png", dc: "/assets/cricbuzz/team-logo-860040.png",
      gt: "/assets/cricbuzz/team-logo-860068.png", kkr: "/assets/cricbuzz/team-logo-860046.png",
      lsg: "/assets/cricbuzz/team-logo-882545.png", mi: "/assets/cricbuzz/team-logo-860053.png",
      pbks: "/assets/cricbuzz/team-logo-860084.png", rcb: "/assets/cricbuzz/team-logo-860056.png",
      rr: "/assets/cricbuzz/team-logo-860055.png", srh: "/assets/cricbuzz/team-logo-860066.png"
    };
    return map[shortName(name).toLowerCase()] ? apiBase + map[shortName(name).toLowerCase()] : "";
  }

  function splitScores(scoreText, match) {
    const rows = Array.from(String(scoreText || "").matchAll(/([A-Z]{2,6})\\s+(\\d{1,3}\\s*[-/]\\s*\\d{1,2})\\s*\\(([\\d.]+)\\)/g)).map((item) => ({
      team: item[1],
      score: item[2].replace(/\\s+/g, ""),
      overs: item[3]
    }));
    const t1 = rows.find((row) => row.team === shortName(match.team1)) || rows[0];
    const t2 = rows.find((row) => row.team === shortName(match.team2)) || rows[1];
    return { t1, t2 };
  }

  function resultText(score, match) {
    const text = String(score?.statusText || match?.rawText || "Waiting for score update").replace(/\\s+/g, " ").trim();
    return text.match(/([A-Z][A-Za-z\\s]+ won by [^.,|]+|[A-Z][A-Za-z\\s]+ need [^.,|]+|Match tied|No result)/i)?.[0] || text;
  }

  function teamHtml(name, row) {
    const logo = logoFor(name);
    const label = shortName(name);
    return '<div class="team">' +
      (logo ? '<img class="logo" src="' + logo + '" alt="">' : '<div class="logo fallback">' + escapeHtml(label) + '</div>') +
      '<div class="name">' + escapeHtml(label) + '</div>' +
      '<div class="score">' + escapeHtml(row?.score || (row ? "Yet to bat" : "--")) + '</div>' +
      (row?.overs ? '<div class="overs">(' + escapeHtml(row.overs) + ')</div>' : '') +
      '</div>';
  }

  function tabs() {
    return '<div class="tabs">' +
      '<button type="button" data-tab="recent" class="' + (state.tab === "recent" ? "active" : "") + '">Recent</button>' +
      '<button type="button" data-tab="live" class="' + (state.tab === "live" ? "active" : "") + '">Live</button>' +
      '<button type="button" data-tab="result" class="' + (state.tab === "result" ? "active" : "") + '">Result</button>' +
      '</div>';
  }

  function isCompleted(match) {
    return String(match?.status || "").toUpperCase() === "COMPLETED" || /won by|match tied|no result/i.test(String(match?.rawText || match?.embeddedScore?.statusText || ""));
  }

  function matchList(matches, mode) {
    const items = matches.slice(0, 8);
    if (items.length === 0) return '<div class="empty">No IPL ' + (mode === "result" ? "results" : "recent matches") + ' yet</div>';
    return '<div class="list">' + items.map((match) => {
      const rows = splitScores(match?.embeddedScore?.score, match || {});
      const t1Logo = logoFor(match.team1);
      const t2Logo = logoFor(match.team2);
      const result = resultText(match.embeddedScore, match);
      return '<div class="row">' +
        '<div class="row-main">' +
          (t1Logo ? '<img class="logo mini" src="' + t1Logo + '" alt="">' : '<span></span>') +
          '<strong>' + escapeHtml(shortName(match.team1)) + '</strong>' +
          '<div class="scoreline">' + escapeHtml(rows.t1?.score || "--") + (rows.t1?.overs ? '<div class="small">(' + escapeHtml(rows.t1.overs) + ')</div>' : '') + '</div>' +
          '<strong class="right">' + escapeHtml(shortName(match.team2)) + '</strong>' +
          (t2Logo ? '<img class="logo mini" src="' + t2Logo + '" alt="">' : '<span></span>') +
        '</div>' +
        '<div class="' + (mode === "result" ? "won" : "small") + '">' + escapeHtml(result) + '</div>' +
        '<div class="small">' + escapeHtml(match.matchType || "T20") + (match.venue ? " &middot; " + escapeHtml(match.venue) : "") + '</div>' +
      '</div>';
    }).join("") + '</div>';
  }

  function renderLoading(message) {
    root.innerHTML = styles() + '<div class="card"><div class="head"><span class="brand">Indian Premier League</span></div><div class="loading">' + message + '</div></div>';
  }

  function bindTabs() {
    Array.from(root.querySelectorAll("[data-tab]")).forEach((button) => {
      button.addEventListener("click", () => {
        state.tab = button.getAttribute("data-tab") || "live";
        renderWidget();
      });
    });
  }

  function renderLive(match, score) {
    if (!match) return '<div class="empty">No live IPL match right now</div>';
    const rows = splitScores(score?.score || match?.embeddedScore?.score, match);
    return '<div class="body">' +
      '<div class="teams">' + teamHtml(match.team1, rows.t1) + teamHtml(match.team2, rows.t2) + '</div>' +
      '<div class="result">' + escapeHtml(resultText(score || match.embeddedScore, match)) + '</div>' +
      '<div class="meta">' + escapeHtml(match.matchType || "T20") + (match.venue ? " &middot; " + escapeHtml(match.venue) : "") + '</div>' +
    '</div>';
  }

  function renderWidget() {
    const completed = state.matches.filter(isCompleted);
    const status = state.tab === "live" ? (state.match?.status || "LIVE") : state.tab.toUpperCase();
    const body = state.tab === "live"
      ? renderLive(state.match, state.score)
      : '<div class="body">' + matchList(completed, state.tab === "result" ? "result" : "recent") + '</div>';
    root.innerHTML = styles() +
      '<div class="card">' +
        '<div class="head"><span class="brand">Indian Premier League</span><span class="live">' + escapeHtml(status) + '</span></div>' +
        tabs() +
        body +
        '<div class="foot"><span>Powered by Cricket Live</span><span>' + new Date().toLocaleTimeString() + '</span></div>' +
      '</div>';
    bindTabs();
  }

  async function load() {
    if (!apiKey) {
      renderLoading('<span class="error">Missing data-api-key</span>');
      return;
    }

    try {
      const headers = { "x-api-key": apiKey };
      const matchesResponse = await fetch(apiBase + "/api/v1/matches", { headers });
      const matchesPayload = await matchesResponse.json();
      if (!matchesResponse.ok) throw new Error(matchesPayload.error || "API request failed");
      state.matches = Array.isArray(matchesPayload.data) ? matchesPayload.data : [];

      const liveResponse = await fetch(apiBase + "/api/v1/live-match", { headers });
      const livePayload = await liveResponse.json();
      if (!liveResponse.ok) throw new Error(livePayload.error || "API request failed");
      state.match = livePayload.data || state.matches.find((match) => match.status === "LIVE") || null;
      state.score = state.match?.embeddedScore || null;

      if (state.match) {
        const scoreResponse = await fetch(apiBase + "/api/v1/score/" + state.match.id, { headers });
        const scorePayload = await scoreResponse.json();
        state.score = scoreResponse.ok ? scorePayload.data || state.match.embeddedScore : state.match.embeddedScore;
      }

      renderWidget();
    } catch (error) {
      renderLoading('<span class="error">' + (error.message || "Widget unavailable") + '</span>');
    }
  }

  renderLoading("Loading live score...");
  load();
  state.timer = window.setInterval(load, refreshMs);
})();`);
  };

  createApiKey = async (request: Request, response: Response) => {
    const name = typeof request.body?.name === "string" ? request.body.name : "";
    const email = typeof request.body?.email === "string" ? request.body.email : "";

    if (!name.trim() || !email.trim()) {
      response.status(400).json({ error: "Name and email are required" });
      return;
    }

    let result;
    try {
      result = await this.apiKeyService.createApiKey({ name, email });
    } catch (error) {
      response.status(503).json({
        error: error instanceof Error ? error.message : "API key generation is unavailable"
      });
      return;
    }

    response.status(201).json({
      data: result,
      message: "Copy this API key now. It will not be shown again."
    });
  };
}
