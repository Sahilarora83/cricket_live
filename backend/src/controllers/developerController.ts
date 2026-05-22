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
          exampleBox.value = 'fetch("' + location.origin + '/api/v1/live-match", {\\n  headers: { "x-api-key": "' + currentKey + '" }\\n})';
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
