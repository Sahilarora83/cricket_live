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
          exampleBox.value = '<div id="cricket-live-widget"></div>\\n<script src="' + location.origin + '/api/developer/widget.js" data-api-key="' + currentKey + '" data-target="cricket-live-widget" data-refresh="30000"></script>';
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
  const state = { timer: 0 };

  function styles() {
    return '<style>' +
      ':host{display:block;max-width:440px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17231f}' +
      '.card{border:1px solid #16843f;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 10px 28px rgba(24,40,33,.08)}' +
      '.head{align-items:center;background:#243b82;color:#fff;display:flex;gap:10px;padding:12px 14px}' +
      '.brand{font-size:17px;font-weight:700}.tabs{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid #dfe5dc}' +
      '.tabs span{text-align:center;padding:10px 6px;font-weight:650}.tabs .active{background:#078533;color:#fff}' +
      '.body{padding:14px}.teams{align-items:center;display:grid;gap:10px;grid-template-columns:1fr 1fr}.team{display:grid;gap:6px;justify-items:center;text-align:center}' +
      '.logo{background:#f7f8f4;border:1px solid #e2e7df;border-radius:8px;height:44px;object-fit:contain;padding:5px;width:44px}' +
      '.fallback{align-items:center;display:flex;justify-content:center;color:#6b4b2e;font-weight:800}.score{font-size:20px;font-weight:750}.overs{color:#6d7974;font-size:13px}.name{font-weight:750}' +
      '.result{font-weight:750;margin-top:12px;text-align:center}.meta{color:#68756f;font-size:13px;margin-top:6px;text-align:center}.foot{align-items:center;border-top:1px solid #e5ebe2;color:#68756f;display:flex;font-size:12px;justify-content:space-between;padding:8px 12px}' +
      '.live{color:#078533;font-weight:800}.error{color:#a32016}.loading{color:#68756f;padding:18px;text-align:center}' +
      '</style>';
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
      (logo ? '<img class="logo" src="' + logo + '" alt="">' : '<div class="logo fallback">' + label + '</div>') +
      '<div class="name">' + label + '</div>' +
      '<div class="score">' + (row?.score || (row ? "Yet to bat" : "--")) + '</div>' +
      (row?.overs ? '<div class="overs">(' + row.overs + ')</div>' : '') +
      '</div>';
  }

  function renderLoading(message) {
    root.innerHTML = styles() + '<div class="card"><div class="head"><span class="brand">Indian Premier League</span></div><div class="loading">' + message + '</div></div>';
  }

  function render(match, score) {
    const rows = splitScores(score?.score || match?.embeddedScore?.score, match);
    root.innerHTML = styles() +
      '<div class="card">' +
        '<div class="head"><span class="brand">Indian Premier League</span><span class="live">' + (match.status || "LIVE") + '</span></div>' +
        '<div class="tabs"><span>Fixture</span><span class="active">Live</span><span>Result</span></div>' +
        '<div class="body">' +
          '<div class="teams">' + teamHtml(match.team1, rows.t1) + teamHtml(match.team2, rows.t2) + '</div>' +
          '<div class="result">' + resultText(score || match.embeddedScore, match) + '</div>' +
          '<div class="meta">' + (match.matchType || "T20") + (match.venue ? " · " + match.venue : "") + '</div>' +
        '</div>' +
        '<div class="foot"><span>Powered by Cricket Live</span><span>' + new Date().toLocaleTimeString() + '</span></div>' +
      '</div>';
  }

  async function load() {
    if (!apiKey) {
      renderLoading('<span class="error">Missing data-api-key</span>');
      return;
    }

    try {
      const headers = { "x-api-key": apiKey };
      const liveResponse = await fetch(apiBase + "/api/v1/live-match", { headers });
      const livePayload = await liveResponse.json();
      if (!liveResponse.ok) throw new Error(livePayload.error || "API request failed");
      const match = livePayload.data;
      if (!match) {
        renderLoading("No live IPL match right now");
        return;
      }
      const scoreResponse = await fetch(apiBase + "/api/v1/score/" + match.id, { headers });
      const scorePayload = await scoreResponse.json();
      render(match, scoreResponse.ok ? scorePayload.data : match.embeddedScore);
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
