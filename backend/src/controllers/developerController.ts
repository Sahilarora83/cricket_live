import type { Request, Response } from "express";
import { ApiKeyServiceError, type ApiKeyService } from "../services/apiKeyService.js";

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
      body { margin: 0; min-height: 100vh; background: #f4f7f2; color: #111f1a; padding: 28px; }
      body:before { content: ""; position: fixed; inset: 0; pointer-events: none; background: radial-gradient(circle at 18% 12%, rgba(12, 118, 84, .12), transparent 32%), radial-gradient(circle at 88% 2%, rgba(191, 118, 31, .10), transparent 30%); }
      main { position: relative; width: min(1120px, 100%); margin: 0 auto; }
      .hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(280px, .9fr); gap: 24px; align-items: stretch; }
      .intro, .card { background: rgba(255, 255, 255, .92); border: 1px solid #dfe7dc; border-radius: 18px; box-shadow: 0 22px 60px rgba(28, 45, 36, .10); }
      .intro { padding: 34px; display: flex; flex-direction: column; justify-content: space-between; min-height: 100%; overflow: hidden; position: relative; }
      .eyebrow { color: #9b5c12; font-size: 12px; font-weight: 900; letter-spacing: .16em; margin: 0 0 14px; text-transform: uppercase; }
      h1 { font-size: clamp(2rem, 5vw, 4rem); line-height: 1.02; margin: 0 0 16px; max-width: 720px; }
      h2 { font-size: 19px; margin: 0; }
      p { color: #53625c; line-height: 1.58; margin: 0; }
      code { background: #eef4eb; border: 1px solid #dce8d8; border-radius: 6px; color: #10231b; padding: 2px 6px; }
      .stats { display: grid; gap: 12px; grid-template-columns: repeat(3, 1fr); margin-top: 34px; }
      .stat { background: #f8faf6; border: 1px solid #e0e8dc; border-radius: 14px; padding: 16px; }
      .stat strong { display: block; font-size: 22px; margin-bottom: 3px; }
      .stat span { color: #66736e; font-size: 12px; font-weight: 800; text-transform: uppercase; }
      .card { padding: 24px; }
      .card-head { align-items: center; display: flex; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
      .badge { background: #10231b; border-radius: 999px; color: #fff; font-size: 12px; font-weight: 800; padding: 8px 12px; white-space: nowrap; }
      form { display: grid; gap: 14px; }
      label { color: #20362d; display: grid; gap: 7px; font-size: 13px; font-weight: 800; }
      input, textarea { background: #fbfcfa; border: 1px solid #d8e2d5; border-radius: 12px; color: #10231b; font: inherit; font-weight: 650; outline: 0; padding: 14px 15px; width: 100%; }
      input:focus, textarea:focus { border-color: #149463; box-shadow: 0 0 0 4px rgba(20, 148, 99, .12); }
      button { background: #0c8f5b; border: 0; border-radius: 12px; color: #fff; cursor: pointer; font: inherit; font-weight: 900; min-height: 48px; padding: 0 18px; transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease; }
      button:hover { box-shadow: 0 12px 24px rgba(12, 143, 91, .20); transform: translateY(-1px); }
      button.secondary { background: #132820; }
      button.secondary:hover { box-shadow: 0 12px 24px rgba(19, 40, 32, .18); }
      button.danger { background: #b42318; }
      button.danger:hover { box-shadow: 0 12px 24px rgba(180, 35, 24, .18); }
      button:disabled { cursor: wait; opacity: .65; transform: none; }
      textarea { min-height: 96px; resize: vertical; }
      .result { background: #f8faf6; border: 1px solid #dfe8dc; border-radius: 16px; display: none; gap: 14px; margin-top: 18px; padding: 18px; }
      .result.visible { display: grid; }
      .result-title { color: #20362d; font-weight: 900; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; }
      .status { background: #fff9ed; border: 1px solid #f2dec0; border-left: 5px solid #c47a16; border-radius: 12px; color: #6a4a19; margin: 0; padding: 13px 14px; }
      .ok { background: #edf8f2; border-color: #ccebd8; border-left-color: #0b8f5a; color: #0b633f; }
      .bad { background: #fff1f0; border-color: #ffd3cf; border-left-color: #b42318; color: #8d1f17; }
      .panel { margin-top: 24px; }
      .panel .card { box-shadow: 0 14px 38px rgba(28, 45, 36, .07); }
      .grid2 { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
      .muted { color: #68756f; font-size: 14px; margin-top: 6px; }
      @media (max-width: 860px) { body { padding: 18px; } .hero { grid-template-columns: 1fr; } .stats { grid-template-columns: 1fr; } }
      @media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } .intro, .card { padding: 20px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="intro">
          <div>
            <p class="eyebrow">Cricket Live Command</p>
            <h1>Developer API access</h1>
            <p>Generate a domain-locked API key for the embeddable live score widget. Use the <code>x-api-key</code> header for direct API calls.</p>
          </div>
          <div class="stats">
            <div class="stat"><strong>OTP</strong><span>Email verified</span></div>
            <div class="stat"><strong>Domain</strong><span>Origin locked</span></div>
            <div class="stat"><strong>Live</strong><span>Score ready</span></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div>
              <h2>Create API key</h2>
              <p class="muted">One active key per email by default.</p>
            </div>
            <span class="badge">Open source plan</span>
          </div>

          <form id="keyForm">
            <label>
              App name
              <input name="name" placeholder="My cricket app" required />
            </label>
            <label>
              Email
              <input name="email" type="email" placeholder="developer@example.com" required />
            </label>
            <label>
              Allowed website domain
              <input name="allowedOrigin" placeholder="https://example.com" required />
            </label>
            <div class="grid2">
              <button id="sendCreateOtpBtn" type="button" class="secondary">Send OTP</button>
              <label>
                OTP
                <input name="otp" inputmode="numeric" maxlength="6" placeholder="123456" required />
              </label>
            </div>
            <button id="generateKeyBtn" type="submit">Generate API key</button>
          </form>

          <section id="result" class="result">
            <div class="result-title">Your API key</div>
            <textarea id="apiKey" readonly></textarea>
            <p id="quotaStatus" class="status">Copy it now. The full key is shown only once.</p>
            <div class="actions">
              <button id="copyBtn" type="button" class="secondary">Copy key</button>
              <button id="testBtn" type="button">Test key</button>
            </div>
            <p id="testStatus" class="status"></p>
            <div class="result-title">Embed snippet</div>
            <textarea id="example" readonly></textarea>
          </section>
        </div>
      </section>

      <section class="panel">
        <div class="card">
          <div class="card-head">
            <div>
              <h2>Revoke leaked key</h2>
              <p class="muted">Verify your email with OTP, then revoke all active keys or one key prefix.</p>
            </div>
            <span class="badge">Recovery</span>
          </div>
          <form id="revokeForm">
            <div class="grid2">
              <label>
                Email
                <input name="email" type="email" placeholder="developer@example.com" required />
              </label>
              <label>
                Key prefix optional
                <input name="keyPrefix" placeholder="cricket_live_xxxxx" />
              </label>
            </div>
            <div class="grid2">
              <button id="sendRevokeOtpBtn" type="button" class="secondary">Send revoke OTP</button>
              <label>
                OTP
                <input name="otp" inputmode="numeric" maxlength="6" placeholder="123456" required />
              </label>
            </div>
            <button type="submit" class="danger">Revoke key</button>
          </form>
        </div>
      </section>
    </main>

    <script>
      const form = document.getElementById("keyForm");
      const revokeForm = document.getElementById("revokeForm");
      const result = document.getElementById("result");
      const apiKeyBox = document.getElementById("apiKey");
      const exampleBox = document.getElementById("example");
      const testStatus = document.getElementById("testStatus");
      const quotaStatus = document.getElementById("quotaStatus");
      let currentKey = "";

      async function postJson(path, body) {
        const response = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Request failed");
        return payload;
      }

      document.getElementById("sendCreateOtpBtn").addEventListener("click", async () => {
        const button = document.getElementById("sendCreateOtpBtn");
        const formData = new FormData(form);
        button.disabled = true;
        testStatus.className = "status";
        testStatus.textContent = "Sending OTP...";
        try {
          const payload = await postJson("/api/developer/api-key-otp", { email: formData.get("email"), purpose: "create" });
          testStatus.className = "status ok";
          testStatus.textContent = payload.data.delivered ? "OTP sent to email." : payload.data.devCode ? "SMTP not configured. Dev OTP: " + payload.data.devCode : "OTP created, but SMTP is not configured on the server.";
        } catch (error) {
          testStatus.className = "status bad";
          testStatus.textContent = error.message || "Could not send OTP";
        } finally {
          button.disabled = false;
        }
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = document.getElementById("generateKeyBtn");
        button.disabled = true;
        button.textContent = "Generating...";
        testStatus.textContent = "";

        try {
          const formData = new FormData(form);
          const payload = await postJson("/api/developer/api-keys", {
            name: formData.get("name"),
            email: formData.get("email"),
            otp: formData.get("otp"),
            allowedOrigins: [formData.get("allowedOrigin")]
          });

          currentKey = payload.data.key;
          apiKeyBox.value = currentKey;
          exampleBox.value = '<div id="cricket-live-widget">Loading live cricket scores...</div>\\n<script async src="' + location.origin + '/api/developer/widget.js" data-api-key="' + currentKey + '" data-target="cricket-live-widget" data-refresh="30000"><\\/script>';
          quotaStatus.className = "status ok";
          quotaStatus.textContent = "Copy it now. Limit: " + payload.data.monthlyQuota + " requests/month for this email. Allowed domain: " + (payload.data.allowedOrigins || []).join(", ") + ".";
          result.classList.add("visible");
        } catch (error) {
          testStatus.className = "status bad";
          testStatus.textContent = error.message || "Could not generate API key";
        } finally {
          button.disabled = false;
          button.textContent = "Generate API key";
        }
      });

      document.getElementById("sendRevokeOtpBtn").addEventListener("click", async () => {
        const button = document.getElementById("sendRevokeOtpBtn");
        const formData = new FormData(revokeForm);
        button.disabled = true;
        testStatus.className = "status";
        testStatus.textContent = "Sending revoke OTP...";
        try {
          const payload = await postJson("/api/developer/api-key-otp", { email: formData.get("email"), purpose: "revoke" });
          testStatus.className = "status ok";
          testStatus.textContent = payload.data.delivered ? "Revoke OTP sent to email." : payload.data.devCode ? "SMTP not configured. Dev OTP: " + payload.data.devCode : "OTP created, but SMTP is not configured on the server.";
        } catch (error) {
          testStatus.className = "status bad";
          testStatus.textContent = error.message || "Could not send OTP";
        } finally {
          button.disabled = false;
        }
      });

      revokeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = revokeForm.querySelector("button.danger");
        const formData = new FormData(revokeForm);
        button.disabled = true;
        testStatus.className = "status";
        testStatus.textContent = "Revoking...";
        try {
          const payload = await postJson("/api/developer/api-keys/revoke", {
            email: formData.get("email"),
            otp: formData.get("otp"),
            keyPrefix: formData.get("keyPrefix")
          });
          testStatus.className = "status ok";
          testStatus.textContent = "Revoked " + payload.data.revoked + " active key(s).";
        } catch (error) {
          testStatus.className = "status bad";
          testStatus.textContent = error.message || "Could not revoke key";
        } finally {
          button.disabled = false;
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
  const boot = () => {
  const apiKey = script?.dataset.apiKey || "";
  const targetId = script?.dataset.target || "";
  const refreshMs = Math.max(Number(script?.dataset.refresh || 30000), 30000);
  const apiBase = new URL(script?.src || location.href).origin;
  const mount = targetId ? document.getElementById(targetId) : null;
  const host = mount || document.createElement("div");

  if (!mount && script?.parentNode) {
    script.parentNode.insertBefore(host, script.nextSibling);
  }

  const root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
  const state = { timer: 0, tab: "live", matches: [], match: null, score: null, loading: false, lastMatchesAt: 0 };

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
    const rows = new Map();
    Array.from(String(scoreText || "").matchAll(/([A-Z]{2,6})\\s+(\\d{1,3}\\s*[-/]\\s*\\d{1,2})\\s*\\(([\\d.]+)\\)/g)).forEach((item) => {
      rows.set(item[1], {
        team: item[1],
        score: item[2].replace(/\\s+/g, ""),
        overs: normalizeOvers(item[3])
      });
    });
    const t1 = rows.get(shortName(match.team1));
    const t2 = rows.get(shortName(match.team2));
    return { t1, t2 };
  }

  function normalizeOvers(value) {
    const match = String(value || "").match(/^(\\d+)(?:\\.(\\d+))?$/);
    if (!match) return String(value || "");
    const overs = Number(match[1]);
    const balls = Number(match[2] || 0);
    return balls >= 6 ? String(overs + Math.floor(balls / 6)) + "." + String(balls % 6) : match[2] === undefined ? String(overs) : String(overs) + "." + String(balls);
  }

  function mergeScores(baseScore, latestScore, match) {
    const rows = new Map();
    [baseScore, latestScore].forEach((scoreText) => {
      Array.from(String(scoreText || "").matchAll(/([A-Z]{2,6})\\s+(\\d{1,3}\\s*[-/]\\s*\\d{1,2})\\s*\\(([\\d.]+)\\)/g)).forEach((item) => {
        rows.set(item[1], item[1] + " " + item[2].replace(/\\s+/g, "") + " (" + normalizeOvers(item[3]) + ")");
      });
    });
    return [shortName(match.team1), shortName(match.team2)].map((team) => rows.get(team)).filter(Boolean).join(", ");
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
    const scoreText = mergeScores(match?.embeddedScore?.score, score?.score, match);
    const rows = splitScores(scoreText, match);
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
    if (state.loading) return;
    state.loading = true;
    try {
      const headers = apiKey ? { "x-api-key": apiKey } : {};
      if (!state.lastMatchesAt || Date.now() - state.lastMatchesAt > 60000) {
        const matchesResponse = await fetch(apiBase + "/api/v1/matches", { headers, cache: "no-store" });
        const matchesPayload = await matchesResponse.json();
        if (!matchesResponse.ok) throw new Error(matchesPayload.error || "API request failed");
        state.matches = Array.isArray(matchesPayload.data) ? matchesPayload.data : [];
        state.lastMatchesAt = Date.now();
      }

      const liveResponse = await fetch(apiBase + "/api/v1/live-match", { headers, cache: "no-store" });
      const livePayload = await liveResponse.json();
      if (!liveResponse.ok) throw new Error(livePayload.error || "API request failed");
      state.match = livePayload.data || state.matches.find((match) => match.status === "LIVE") || null;
      state.score = state.match?.embeddedScore || null;

      if (state.match) {
        const scoreResponse = await fetch(apiBase + "/api/v1/score/" + state.match.id, { headers, cache: "no-store" });
        const scorePayload = await scoreResponse.json();
        state.score = scoreResponse.ok ? scorePayload.data || state.match.embeddedScore : state.match.embeddedScore;
      }

      renderWidget();
    } catch (error) {
      renderLoading('<span class="error">' + (error.message || "Widget unavailable") + '</span>');
    } finally {
      state.loading = false;
    }
  }

  renderLoading("Loading live score...");
  const startLoading = () => {
    load();
    state.timer = window.setInterval(load, refreshMs);
  };
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        startLoading();
      }
    }, { rootMargin: "160px" });
    observer.observe(host);
  } else {
    startLoading();
  }
  };
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();`);
  };

  requestApiKeyOtp = async (request: Request, response: Response) => {
    const email = typeof request.body?.email === "string" ? request.body.email : "";
    const purpose = request.body?.purpose === "revoke" ? "revoke" : "create";

    try {
      const result = await this.apiKeyService.requestOtp({ email, purpose });
      response.status(201).json({ data: result, message: "OTP generated." });
    } catch (error) {
      this.sendApiKeyError(response, error, "OTP generation is unavailable");
    }
  };

  createApiKey = async (request: Request, response: Response) => {
    const name = typeof request.body?.name === "string" ? request.body.name : "";
    const email = typeof request.body?.email === "string" ? request.body.email : "";
    const otp = typeof request.body?.otp === "string" ? request.body.otp : "";
    const allowedOrigins = Array.isArray(request.body?.allowedOrigins)
      ? request.body.allowedOrigins.filter((item: unknown): item is string => typeof item === "string")
      : [];

    if (!name.trim() || !email.trim() || !otp.trim()) {
      response.status(400).json({ error: "Name, email and OTP are required" });
      return;
    }

    let result;
    try {
      result = await this.apiKeyService.createApiKey({ name, email, otp, allowedOrigins });
    } catch (error) {
      this.sendApiKeyError(response, error, "API key generation is unavailable");
      return;
    }

    response.status(201).json({
      data: result,
      message: "Copy this API key now. It will not be shown again."
    });
  };

  revokeApiKeys = async (request: Request, response: Response) => {
    const email = typeof request.body?.email === "string" ? request.body.email : "";
    const otp = typeof request.body?.otp === "string" ? request.body.otp : "";
    const keyPrefix = typeof request.body?.keyPrefix === "string" ? request.body.keyPrefix : undefined;

    if (!email.trim() || !otp.trim()) {
      response.status(400).json({ error: "Email and OTP are required" });
      return;
    }

    try {
      const result = await this.apiKeyService.revokeApiKeys({ email, otp, keyPrefix });
      response.json({ data: result, message: "API key revoked." });
    } catch (error) {
      this.sendApiKeyError(response, error, "API key revoke is unavailable");
    }
  };

  private sendApiKeyError(response: Response, error: unknown, fallback: string) {
    const status = error instanceof ApiKeyServiceError ? error.status : 503;
    response.status(status).json({
      error: error instanceof Error ? error.message : fallback
    });
  }
}
