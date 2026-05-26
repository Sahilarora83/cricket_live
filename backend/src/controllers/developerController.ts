import type { Request, Response } from "express";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { ApiKeyServiceError, isApiAdmin, type ApiKeyService } from "../services/apiKeyService.js";
import { FirebaseAuthError, verifyFirebaseIdToken } from "../services/firebaseAuthService.js";

function verifyPasswordHash(password: string, storedHash: string) {
  const [algorithm, expectedHash] = storedHash.split(":");
  if (algorithm !== "sha256" || !expectedHash) return false;
  const actualHash = crypto.createHash("sha256").update(password).digest("hex");
  return safeEqual(actualHash, expectedHash);
}

function createAdminTokenForPassword(email: string, password: string) {
  const loginEmail = (env.API_ADMIN_LOGIN_EMAIL || env.API_ADMIN_EMAILS.split(/[,\s]+/)[0] || "").trim().toLowerCase();
  if (!loginEmail || !env.API_ADMIN_PASSWORD_HASH || !env.API_ADMIN_SESSION_SECRET) return "";
  if (email !== loginEmail || !isApiAdmin(email) || !verifyPasswordHash(password, env.API_ADMIN_PASSWORD_HASH)) return "";
  return signAdminToken(email);
}

function signAdminToken(email: string) {
  const payload = Buffer.from(
    JSON.stringify({
      email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 6
    })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", env.API_ADMIN_SESSION_SECRET || "").update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyAdminToken(token: string) {
  if (!token || !env.API_ADMIN_SESSION_SECRET) return "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return "";
  const expectedSignature = crypto.createHmac("sha256", env.API_ADMIN_SESSION_SECRET).update(payload).digest("base64url");
  if (!safeEqual(signature, expectedSignature)) return "";
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string; exp?: number };
    const email = String(data.email || "").toLowerCase();
    if (!email || !data.exp || data.exp < Math.floor(Date.now() / 1000) || !isApiAdmin(email)) return "";
    return email;
  } catch {
    return "";
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export class DeveloperController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  getAdminConsole = (request: Request, response: Response) => {
    const queryEmail = typeof request.query.email === "string" ? request.query.email.trim().toLowerCase() : "";
    const queryPassword = typeof request.query.password === "string" ? request.query.password : "";
    const initialAdminToken = queryEmail && queryPassword ? createAdminTokenForPassword(queryEmail, queryPassword) : "";
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cricket Live Admin</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { background: #0f0f0f; color: #f5f5f5; margin: 0; }
      button, input, textarea, select { font: inherit; }
      .wrap { margin: 0 auto; max-width: 1240px; padding: 28px; }
      .top { align-items: center; border-bottom: 1px solid #2b2b2b; display: flex; gap: 16px; justify-content: space-between; padding-bottom: 18px; }
      h1 { font-size: 28px; font-weight: 560; margin: 0; }
      h2 { font-size: 18px; margin: 0; }
      p { color: #a3a3a3; line-height: 1.55; margin: 6px 0 0; }
      .card { background: #181818; border: 1px solid #303030; border-radius: 14px; padding: 18px; }
      .grid { display: grid; gap: 14px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 20px 0; }
      .layout { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr) 360px; }
      .stack { display: grid; gap: 12px; }
      .stat span, .fine { color: #a3a3a3; font-size: 12px; }
      .stat strong { display: block; font-size: 26px; margin-top: 6px; }
      input { background: #101010; border: 1px solid #363636; border-radius: 10px; color: #fff; padding: 13px 14px; width: 100%; }
      button { background: #f5f5f5; border: 0; border-radius: 10px; color: #111; cursor: pointer; font-weight: 560; min-height: 42px; padding: 0 14px; }
      button.secondary { background: #2b2b2b; border: 1px solid #3a3a3a; color: #fff; }
      button.danger { background: #4a1f1f; border: 1px solid #7a3333; color: #ffd7d7; }
      .row { align-items: start; border: 1px solid #303030; border-radius: 12px; display: grid; gap: 12px; grid-template-columns: 1.2fr .9fr .6fr auto; padding: 14px; }
      .pill { border: 1px solid #444; border-radius: 999px; display: inline-flex; font-size: 12px; padding: 5px 9px; width: fit-content; }
      .approved { border-color: #10a37f; color: #b5f4df; }
      .pending { border-color: #8a6d2f; color: #ffe7a3; }
      .rejected, .blocked { border-color: #7a3333; color: #ffd7d7; }
      .logs { max-height: 480px; overflow: auto; }
      .log { border-bottom: 1px solid #2b2b2b; padding: 10px 0; }
      .hidden { display: none !important; }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .status { border-left: 4px solid #737373; background: #171a20; border-radius: 10px; color: #d4d4d4; padding: 12px; }
      .status.ok { border-left-color: #10a37f; color: #b5f4df; }
      .status.bad { border-left-color: #ef4444; color: #ffd7d7; }
      @media (max-width: 900px) { .grid, .layout, .row { grid-template-columns: 1fr; } .wrap { padding: 14px; } }
    </style>
  </head>
  <body>
    <main class="wrap">
      <header class="top">
        <div><h1>Cricket Live Admin</h1><p>Private approval center for users, keys, domains, usage and blocks.</p></div>
        <button id="logoutBtn" class="secondary hidden" type="button">Sign out</button>
      </header>

      <section id="loginCard" class="card" style="margin-top:20px;max-width:460px;">
        <h2>Admin login</h2>
        <p>Use the configured admin email and password.</p>
        <form id="loginForm" class="stack" style="margin-top:14px;">
          <input name="email" type="email" placeholder="admin@example.com" autocomplete="username" required />
          <input name="password" type="password" placeholder="Password" autocomplete="current-password" required />
          <button type="submit">Open admin console</button>
        </form>
        <p id="loginStatus" class="status" style="margin-top:14px;">Admin session is required.</p>
      </section>

      <section id="adminApp" class="hidden">
        <div class="grid">
          <div class="card stat"><span>Users</span><strong id="statUsers">--</strong></div>
          <div class="card stat"><span>API keys</span><strong id="statKeys">--</strong></div>
          <div class="card stat"><span>Pending</span><strong id="statPending">--</strong></div>
          <div class="card stat"><span>Usage</span><strong id="statUsage">--</strong></div>
        </div>
        <div class="layout">
          <div class="stack">
            <div class="card">
              <h2>All API keys</h2>
              <p>Approve, reject, check verification, or block any key.</p>
              <div id="keyRows" class="stack" style="margin-top:14px;"></div>
            </div>
            <div class="card">
              <h2>Users</h2>
              <div id="userRows" class="stack" style="margin-top:14px;"></div>
            </div>
          </div>
          <aside class="card">
            <h2>Realtime request logs</h2>
            <div id="logRows" class="logs"></div>
          </aside>
        </div>
      </section>
    </main>
    <script>
      const loginCard = document.getElementById("loginCard");
      const adminApp = document.getElementById("adminApp");
      const loginStatus = document.getElementById("loginStatus");
      const logoutBtn = document.getElementById("logoutBtn");
      const keyRows = document.getElementById("keyRows");
      const userRows = document.getElementById("userRows");
      const logRows = document.getElementById("logRows");
      const initialAdminToken = ${JSON.stringify(initialAdminToken)};
      let token = initialAdminToken || localStorage.getItem("cricketAdminToken") || "";
      let timer = 0;

      function esc(value) {
        return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
      }
      function number(value) { return Number(value || 0).toLocaleString(); }
      function date(value) { return value ? new Date(value).toLocaleString() : "--"; }
      function setLogin(message, type) {
        loginStatus.className = "status" + (type ? " " + type : "");
        loginStatus.textContent = message;
      }
      async function api(path, options = {}) {
        const response = await fetch(path, {
          ...options,
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...(options.headers || {}) },
          cache: "no-store"
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Request failed");
        return payload.data;
      }
      async function load() {
        const data = await api("/api/developer/admin/overview");
        loginCard.classList.add("hidden");
        adminApp.classList.remove("hidden");
        logoutBtn.classList.remove("hidden");
        document.getElementById("statUsers").textContent = number(data.stats.users);
        document.getElementById("statKeys").textContent = number(data.stats.keys);
        document.getElementById("statPending").textContent = number(data.stats.pending);
        document.getElementById("statUsage").textContent = number(data.stats.usage);
        keyRows.innerHTML = data.keys.map((key) => {
          const status = key.revoked ? "blocked" : key.approvalStatus || "pending";
          return '<div class="row">' +
            '<div><strong>' + esc(key.name) + '</strong><div class="fine">' + esc(key.email) + '</div><div class="fine">' + esc(key.keyPrefix) + '</div></div>' +
            '<div><span class="pill ' + esc(status) + '">' + esc(status) + '</span><div class="fine">Requested: ' + esc((key.requestedDomains || []).join(", ") || "--") + '</div><div class="fine">Approved: ' + esc((key.approvedDomains || []).join(", ") || "--") + '</div></div>' +
            '<div><strong>' + number(key.usageCount) + '</strong><div class="fine">Last used: ' + esc(date(key.lastUsedAt)) + '</div></div>' +
            '<div class="actions">' +
              '<button class="secondary" data-check="' + esc(key.keyPrefix) + '" data-domain="' + esc((key.requestedDomains || [])[0] || "") + '">Check</button>' +
              '<button data-approve="' + esc(key.keyPrefix) + '">Approve</button>' +
              '<button class="secondary" data-reject="' + esc(key.keyPrefix) + '">Reject</button>' +
              '<button class="danger" data-block="' + esc(key.keyPrefix) + '">Block</button>' +
            '</div>' +
          '</div>';
        }).join("") || '<p class="fine">No keys found.</p>';
        userRows.innerHTML = data.users.map((user) => '<div class="row" style="grid-template-columns:1fr auto auto auto;"><div><strong>' + esc(user.email) + '</strong></div><div>Usage ' + number(user.usage) + '</div><div>Active ' + number(user.activeKeys) + '</div><div>Blocked ' + number(user.blocked) + '</div></div>').join("") || '<p class="fine">No users found.</p>';
        logRows.innerHTML = data.recentLogs.map((log) => '<div class="log"><code>' + esc(log.method) + ' ' + esc(log.path) + '</code><div class="fine">' + esc(log.email) + ' · ' + esc(log.status) + ' · ' + esc(log.message) + '</div><div class="fine">' + esc(log.origin || "no origin") + ' · ' + esc(date(log.createdAt)) + '</div></div>').join("") || '<p class="fine">No logs yet.</p>';
      }
      document.getElementById("loginForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await loginWithCredentials(String(form.get("email") || ""), String(form.get("password") || ""));
      });

      async function loginWithCredentials(email, password) {
        setLogin("Signing in...");
        try {
          const response = await fetch("/api/developer/admin/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Login failed");
          token = payload.data.token;
          localStorage.setItem("cricketAdminToken", token);
          history.replaceState(null, "", location.pathname);
          await load();
          timer = setInterval(() => load().catch(() => {}), 10000);
        } catch (error) {
          setLogin(error.message || "Login failed", "bad");
        }
      }
      document.addEventListener("click", async (event) => {
        const target = event.target;
        try {
          if (target.matches("[data-check]")) {
            const data = await api("/api/developer/admin/approvals/verify", { method: "POST", body: JSON.stringify({ keyPrefix: target.dataset.check, domain: target.dataset.domain }) });
            alert(data.ok ? "Verification matched" : "Verification failed: " + data.received);
          } else if (target.matches("[data-approve]")) {
            await api("/api/developer/admin/approvals/review", { method: "POST", body: JSON.stringify({ keyPrefix: target.dataset.approve, action: "approve" }) });
            await load();
          } else if (target.matches("[data-reject]")) {
            const reason = prompt("Reject reason?", "Verification missing or invalid") || "Rejected by administrator";
            await api("/api/developer/admin/approvals/review", { method: "POST", body: JSON.stringify({ keyPrefix: target.dataset.reject, action: "reject", reason }) });
            await load();
          } else if (target.matches("[data-block]")) {
            if (!confirm("Block this API key now?")) return;
            await api("/api/developer/admin/block-key", { method: "POST", body: JSON.stringify({ keyPrefix: target.dataset.block }) });
            await load();
          }
        } catch (error) {
          alert(error.message || "Action failed");
        }
      });
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("cricketAdminToken");
        location.reload();
      });
      function tryQueryLogin() {
        const params = new URLSearchParams(location.search);
        const email = params.get("email") || "";
        const password = params.get("password") || "";
        if (email && password) {
          void loginWithCredentials(email, password);
          return true;
        }
        return false;
      }

      if (initialAdminToken) {
        localStorage.removeItem("cricketAdminToken");
        localStorage.setItem("cricketAdminToken", initialAdminToken);
        token = initialAdminToken;
        history.replaceState(null, "", location.pathname);
        load()
          .then(() => { timer = setInterval(() => load().catch(() => {}), 10000); })
          .catch((error) => setLogin(error.message || "Could not open admin dashboard", "bad"));
      } else if (token) {
        load()
          .then(() => { timer = setInterval(() => load().catch(() => {}), 10000); })
          .catch(() => {
            localStorage.removeItem("cricketAdminToken");
            token = "";
            if (!tryQueryLogin()) {
              setLogin("Admin session expired. Please sign in again.", "bad");
            }
          });
      } else {
        tryQueryLogin();
      }
    </script>
  </body>
</html>`);
  };

  getApiKeyPortal = (_request: Request, response: Response) => {
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com; img-src 'self' data: https://lh3.googleusercontent.com https://*.googleusercontent.com; frame-src https://cricketapi-14e90.firebaseapp.com https://accounts.google.com"
    );
    response.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cricket Live API Key</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #0b0d10; color: #f3f5f7; font-weight: 400; }
      body:before { content: ""; position: fixed; inset: 0; pointer-events: none; background: linear-gradient(120deg, rgba(22, 163, 103, .10), transparent 34%), radial-gradient(circle at 95% 0%, rgba(47, 128, 237, .10), transparent 28%); }
      .shell { display: grid; grid-template-columns: 252px minmax(0, 1fr); min-height: 100vh; position: relative; }
      .sidebar { background: rgba(15, 17, 21, .94); border-right: 1px solid #24272e; padding: 22px 16px; display: flex; flex-direction: column; gap: 24px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
      .brand-row { align-items: center; display: flex; gap: 12px; padding: 0 10px; }
      .brand-mark { align-items: center; background: linear-gradient(135deg, #14b66f, #2f80ed); border-radius: 12px; display: flex; font-weight: 650; height: 38px; justify-content: center; width: 38px; }
      .brand-title { font-size: 16px; font-weight: 560; }
      .brand-sub { color: #8f98a3; font-size: 12px; margin-top: 2px; }
      .nav { display: grid; gap: 5px; }
      .nav-item { align-items: center; border-radius: 10px; color: #b8c0cc; display: flex; font-weight: 430; gap: 10px; padding: 11px 12px; text-decoration: none; transition: background .18s ease, color .18s ease, transform .18s ease; }
      .nav-item:hover { background: #171b22; color: #eef3f8; transform: translateX(1px); }
      .nav-item.active { background: #24272d; color: #ffffff; }
      .nav-dot { background: #5de49b; border-radius: 99px; height: 8px; width: 8px; }
      .nav-item .nav-dot { visibility: hidden; }
      .nav-item.active .nav-dot { visibility: visible; }
      .mobile-nav { display: none; gap: 8px; margin: 14px 0 0; overflow-x: auto; padding-bottom: 4px; }
      .mobile-nav .nav-item { background: #171a20; border: 1px solid #30343b; flex: 0 0 auto; padding: 10px 12px; white-space: nowrap; }
      .side-card { border: 1px solid #2a2e36; border-radius: 14px; margin-top: auto; padding: 14px; background: #171a20; }
      .workspace { min-width: 0; padding: 22px 28px 34px; }
      .topbar { align-items: center; background: rgba(15, 17, 21, .86); border: 1px solid #24272e; border-radius: 18px; display: flex; justify-content: space-between; gap: 16px; padding: 14px 18px; position: sticky; top: 18px; z-index: 5; backdrop-filter: blur(16px); }
      .topbar-left { align-items: center; display: flex; gap: 14px; min-width: 0; }
      .search { align-items: center; background: rgba(17,24,39,.75); border: 1px solid rgba(255,255,255,.08); border-radius: 999px; color: #9ca3af; display: flex; gap: 8px; min-width: 260px; padding: 10px 13px; }
      .search input { background: transparent; border: 0; box-shadow: none; color: #f9fafb; min-height: 0; padding: 0; }
      .search input:focus { border: 0; box-shadow: none; }
      .icon-btn { align-items: center; background: rgba(17,24,39,.8); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; color: #d1d5db; display: inline-flex; height: 42px; justify-content: center; min-height: 42px; padding: 0; width: 42px; }
      .icon-btn { font-size: 0; }
      #themeToggle:before { content: "T"; font-size: 13px; }
      .icon-btn[title="Notifications"]:before { content: "N"; font-size: 13px; }
      .status-badge { align-items: center; background: rgba(34,197,94,.10); border: 1px solid rgba(34,197,94,.24); border-radius: 999px; color: #bbf7d0; display: inline-flex; font-size: 13px; gap: 8px; padding: 9px 12px; white-space: nowrap; }
      .pulse { background: #22c55e; border-radius: 99px; box-shadow: 0 0 0 rgba(34,197,94,.5); height: 8px; width: 8px; animation: livePulse 1.8s infinite; }
      @keyframes livePulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.45); } 70% { box-shadow: 0 0 0 8px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }
      .crumbs { color: #9da6b3; font-size: 14px; font-weight: 430; }
      .auth-actions { align-items: center; display: flex; gap: 10px; }
      .user-card { align-items: center; display: flex; gap: 10px; }
      .avatar { border-radius: 99px; border: 1px solid #3a404b; height: 34px; object-fit: cover; width: 34px; }
      .avatar.placeholder { align-items: center; background: #252b35; display: flex; font-weight: 560; justify-content: center; }
      .content { margin: 28px auto 0; max-width: 1260px; }
      .page { display: none; animation: fadeIn .2s ease; }
      .page.active-page { display: block; }
      .page.hero.active-page { display: grid; }
      .page.hero.active-page > .card.panel { grid-column: 1 / -1; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      .hero { display: grid; grid-template-columns: minmax(0, .92fr) minmax(380px, .78fr); gap: 22px; align-items: start; }
      .intro, .card { background: rgba(31, 33, 38, .92); border: 1px solid #30343b; border-radius: 14px; box-shadow: 0 20px 50px rgba(0, 0, 0, .18); }
      .intro:before, .card:before { content: ""; pointer-events: none; position: absolute; inset: 0; border-radius: inherit; padding: 1px; background: linear-gradient(135deg, rgba(34,197,94,.24), rgba(59,130,246,.14), rgba(255,255,255,.04)); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
      .intro { min-height: 300px; padding: 28px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative; }
      .card { position: relative; overflow: hidden; }
      .eyebrow { color: #62d99f; font-size: 12px; font-weight: 560; letter-spacing: .08em; margin: 0 0 14px; text-transform: uppercase; }
      h1 { font-size: clamp(2rem, 3vw, 2.55rem); font-weight: 520; line-height: 1.12; margin: 0 0 12px; max-width: 720px; }
      h2 { font-size: 18px; font-weight: 560; margin: 0; }
      p { color: #aab3bf; line-height: 1.58; margin: 0; }
      code { background: #101318; border: 1px solid #30343b; border-radius: 6px; color: #e8edf2; padding: 2px 6px; }
      .stats { display: grid; gap: 12px; grid-template-columns: repeat(3, 1fr); margin-top: 24px; }
      .stat { background: #171a20; border: 1px solid #30343b; border-radius: 10px; padding: 16px; }
      .stat strong { display: block; font-size: 18px; font-weight: 540; margin-bottom: 3px; }
      .stat span { color: #8f98a3; font-size: 12px; font-weight: 430; text-transform: uppercase; }
      .card { padding: 24px; }
      .hero-chart { align-items: end; display: flex; gap: 8px; height: 68px; margin-top: 22px; }
      .hero-chart span { background: linear-gradient(180deg, #22c55e, #3b82f6); border-radius: 999px 999px 4px 4px; display: block; flex: 1; opacity: .86; min-height: 16px; }
      .card-head { align-items: center; display: flex; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
      .badge { background: #111419; border: 1px solid #333942; border-radius: 999px; color: #d9fbe9; font-size: 12px; font-weight: 520; padding: 8px 12px; white-space: nowrap; }
      .auth-panel { border: 1px solid #30343b; border-radius: 12px; background: #171a20; display: grid; gap: 12px; margin-bottom: 16px; padding: 14px; }
      .auth-row { align-items: center; display: flex; justify-content: space-between; gap: 12px; }
      form { display: grid; gap: 14px; }
      label { color: #dce3eb; display: grid; gap: 7px; font-size: 13px; font-weight: 520; }
      input, textarea { background: #111419; border: 1px solid #363b45; border-radius: 9px; color: #f3f5f7; font: inherit; font-weight: 400; outline: 0; padding: 14px 15px; width: 100%; }
      input:focus, textarea:focus { border-color: #5de49b; box-shadow: 0 0 0 4px rgba(93, 228, 155, .12); }
      input:disabled { color: #9da6b3; }
      button { background: #ffffff; border: 0; border-radius: 10px; color: #0d0f12; cursor: pointer; font: inherit; font-weight: 560; min-height: 44px; padding: 0 18px; transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease; }
      button:hover { box-shadow: 0 14px 28px rgba(255, 255, 255, .10); transform: translateY(-1px); }
      button.primary { background: #16a367; color: #fff; }
      button.secondary { background: #2b3038; color: #f4f7fb; }
      button.danger { background: #ef4444; color: #fff; }
      button.tiny { font-size: 12px; min-height: 34px; padding: 0 11px; }
      button:disabled { cursor: not-allowed; opacity: .45; transform: none; }
      .auth-loading button, .auth-loading input, .auth-loading textarea { pointer-events: none; }
      .skeleton { animation: pulse 1.35s ease-in-out infinite; background: linear-gradient(90deg, #1a1e24 0%, #262b34 50%, #1a1e24 100%); background-size: 220% 100%; border-radius: 8px; color: transparent !important; display: inline-block; min-height: 1em; }
      .skeleton-line { height: 18px; width: min(100%, 340px); }
      .skeleton-button { height: 44px; width: 244px; }
      .skeleton-card { height: 58px; width: 100%; }
      .auth-loading .auth-actions > :not(#authSkeleton), .auth-loading #keyForm, .auth-loading #revokeForm, .auth-loading .status:not(.skeleton-status) { visibility: hidden; }
      .auth-ready #authSkeleton { display: none; }
      .auth-loading .skeleton-only { display: block !important; }
      .auth-ready .skeleton-only { display: none !important; }
      @keyframes pulse { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
      textarea { min-height: 96px; resize: vertical; }
      .result { background: #171a20; border: 1px solid #30343b; border-radius: 12px; display: none; gap: 14px; margin-top: 18px; padding: 18px; }
      .result.visible { display: grid; }
      .result-title { color: #ffffff; font-weight: 600; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; }
      .status { background: #181b21; border: 1px solid #373d47; border-left: 4px solid #7c8798; border-radius: 10px; color: #c2cbd7; margin: 0; padding: 12px 13px; }
      .ok { background: rgba(24, 166, 101, .11); border-color: rgba(93, 228, 155, .26); border-left-color: #5de49b; color: #bdf8d8; }
      .bad { background: rgba(239, 68, 68, .10); border-color: rgba(239, 68, 68, .28); border-left-color: #ef4444; color: #ffd6d6; }
      .panel { margin-top: 24px; }
      .grid2 { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
      .usage-grid { display: grid; gap: 12px; grid-template-columns: repeat(4, 1fr); margin-bottom: 16px; }
      .usage-card { background: #171a20; border: 1px solid #30343b; border-radius: 10px; padding: 14px; }
      .usage-card span { color: #8f98a3; display: block; font-size: 12px; margin-bottom: 7px; }
      .usage-card strong { color: #f3f5f7; font-size: 20px; font-weight: 600; }
      .analytics-strip { display: grid; gap: 12px; grid-template-columns: repeat(3, 1fr); margin: 16px 0; }
      .chart-card { background: rgba(17,24,39,.72); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 14px; }
      .sparkline { align-items: end; display: flex; gap: 6px; height: 58px; margin-top: 12px; }
      .sparkline span { background: linear-gradient(180deg, rgba(59,130,246,.95), rgba(34,197,94,.85)); border-radius: 999px; flex: 1; min-height: 10px; }
      .docs-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); }
      .endpoint { background: #171a20; border: 1px solid #30343b; border-radius: 12px; padding: 14px; }
      .endpoint code { display: inline-block; margin-bottom: 9px; }
      .endpoint p { font-size: 13px; }
      .preview-box { background: #0f1217; border: 1px dashed #3c4654; border-radius: 12px; display: grid; gap: 10px; margin-top: 14px; padding: 14px; }
      .two-col { display: grid; gap: 16px; grid-template-columns: 1.2fr .8fr; }
      .activity-list { display: grid; gap: 10px; }
      .activity-item { align-items: center; background: rgba(17,24,39,.72); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; display: flex; gap: 12px; padding: 13px; }
      .activity-dot { background: #22c55e; border-radius: 99px; height: 9px; width: 9px; }
      .split { display: grid; gap: 16px; grid-template-columns: 1.05fr .95fr; }
      .control-grid { display: grid; gap: 10px; grid-template-columns: repeat(3, 1fr); margin-top: 12px; }
      select { background: #111419; border: 1px solid #363b45; border-radius: 9px; color: #f3f5f7; font: inherit; padding: 12px; width: 100%; }
      .code-block { background: #0b1020; border: 1px solid rgba(255,255,255,.08); border-radius: 14px; color: #c7d2fe; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 13px; line-height: 1.7; overflow-x: auto; padding: 14px; white-space: pre; }
      .tab-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
      .tab-row button { background: #111827; color: #d1d5db; min-height: 36px; }
      .tab-row button.active { background: #1f2937; color: #f9fafb; }
      .meter { background: #111419; border: 1px solid #30343b; border-radius: 999px; height: 10px; overflow: hidden; }
      .meter > div { background: #16a367; height: 100%; width: 0%; }
      .keys-table { display: grid; gap: 12px; margin-top: 16px; }
      .key-row { align-items: center; display: grid; gap: 12px; grid-template-columns: 1.25fr .9fr .75fr .8fr auto; padding: 13px 14px; }
      .key-card { background: rgba(17,24,39,.78); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; display: grid; gap: 14px; padding: 16px; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
      .key-card:hover { border-color: rgba(34,197,94,.28); box-shadow: 0 18px 40px rgba(0,0,0,.18); transform: translateY(-2px); }
      .key-card-top { align-items: start; display: flex; justify-content: space-between; gap: 12px; }
      .key-card-meta { color: #9ca3af; display: grid; gap: 4px; font-size: 12px; grid-template-columns: repeat(2, 1fr); }
      .key-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .workflow-steps { display: grid; gap: 10px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 14px 0; }
      .workflow-step { background: #141414; border: 1px solid #303030; border-radius: 12px; padding: 14px; }
      .workflow-step strong { display: block; margin-bottom: 5px; }
      .approval-card { background: #181818; border: 1px solid #303030; border-radius: 14px; display: grid; gap: 12px; padding: 16px; }
      .approval-card.pending { border-color: #5a4a22; }
      .approval-card.approved { border-color: #214638; }
      .approval-card.rejected { border-color: #5b2b2b; }
      .copy-row { display: grid; gap: 8px; grid-template-columns: 1fr auto; align-items: start; }
      .copy-row textarea { min-height: 78px; }
      .progress { background: #0b1020; border-radius: 999px; height: 8px; overflow: hidden; }
      .progress div { background: linear-gradient(90deg, #22c55e, #3b82f6); height: 100%; width: 0%; }
      .empty-state { background: rgba(17,24,39,.7); border: 1px dashed rgba(255,255,255,.12); border-radius: 16px; color: #9ca3af; padding: 18px; }
      .key-head { display: none; }
      .key-prefix { color: #dce3eb; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
      .pill { border: 1px solid #3a404b; border-radius: 999px; color: #c9d2df; display: inline-flex; font-size: 12px; padding: 5px 9px; width: fit-content; }
      .pill.active { border-color: rgba(93, 228, 155, .35); color: #bdf8d8; }
      .pill.revoked { border-color: rgba(239, 68, 68, .35); color: #ffc7c7; }
      .muted { color: #8f98a3; font-size: 14px; margin-top: 6px; }
      .fine { color: #7f8896; font-size: 12px; }
      [hidden] { display: none !important; }
      @media (max-width: 980px) { .shell { grid-template-columns: 1fr; } .sidebar { display: none; } .workspace { padding: 14px; } .topbar { top: 10px; } .mobile-nav { display: flex; } .hero { grid-template-columns: 1fr; } .intro { min-height: auto; } }
      @media (max-width: 840px) { .usage-grid, .docs-grid, .analytics-strip { grid-template-columns: repeat(2, 1fr); } .split, .two-col { grid-template-columns: 1fr; } .key-row { grid-template-columns: 1fr; } .search { min-width: 0; width: 100%; } }
      @media (max-width: 640px) { .grid2, .stats, .usage-grid, .docs-grid, .analytics-strip, .control-grid { grid-template-columns: 1fr; } .workspace { padding: 10px; } .content { margin-top: 16px; } .intro, .card { padding: 18px; } .topbar, .topbar-left, .auth-row { align-items: stretch; flex-direction: column; } .auth-actions { width: 100%; } .auth-actions button { flex: 1; } .mobile-nav { margin-top: 10px; } h1 { font-size: 32px; } .key-card-meta { grid-template-columns: 1fr; } }

      /* OpenAI-style SaaS console pass */
      body { background: #0f0f0f; color: #ececec; }
      body:before { display: none; }
      .shell { grid-template-columns: 260px minmax(0, 1fr); background: #0f0f0f; }
      .sidebar { background: #171717; border-right-color: #2a2a2a; gap: 18px; padding: 18px 12px; }
      .brand-row { border-bottom: 1px solid #2a2a2a; padding: 0 10px 16px; }
      .brand-mark { background: #ececec; border-radius: 8px; color: #111; font-weight: 650; height: 34px; width: 34px; }
      .brand-title { color: #f5f5f5; font-weight: 560; }
      .brand-sub, .muted, .fine, .crumbs { color: #a3a3a3; }
      .nav { gap: 2px; }
      .nav-item { border-radius: 8px; color: #c7c7c7; font-size: 14px; padding: 9px 10px; transform: none; }
      .nav-item:hover { background: #202020; color: #fff; transform: none; }
      .nav-item.active { background: #2a2a2a; color: #fff; }
      .nav-dot { background: #ececec; height: 6px; width: 6px; }
      .side-card { background: #202020; border-color: #303030; border-radius: 12px; }
      .workspace { background: #0f0f0f; padding: 18px 28px 40px; }
      .content { margin-top: 22px; max-width: 1180px; }
      .topbar { background: rgba(23,23,23,.94); border-color: #2a2a2a; border-radius: 14px; box-shadow: none; top: 14px; }
      .search { background: #202020; border-color: #333; border-radius: 10px; min-width: 320px; padding: 10px 12px; }
      .status-badge { background: #202020; border-color: #333; color: #d4d4d4; }
      .pulse { background: #10a37f; }
      .icon-btn { background: #202020; border-color: #333; border-radius: 10px; color: #d4d4d4; }
      .intro, .card, .auth-panel, .stat, .usage-card, .chart-card, .endpoint, .activity-item, .key-card, .empty-state, .result, .preview-box { background: #1c1c1c; border: 1px solid #303030; border-radius: 12px; box-shadow: none; }
      .intro:before, .card:before { display: none; }
      .intro { min-height: 260px; }
      h1 { color: #f5f5f5; font-size: clamp(2rem, 3vw, 2.4rem); font-weight: 540; letter-spacing: 0; }
      h2 { color: #f5f5f5; font-weight: 540; }
      p { color: #a3a3a3; }
      .eyebrow { color: #d4d4d4; font-weight: 520; letter-spacing: .06em; }
      code, .code-block { background: #111; border-color: #303030; color: #e7e7e7; }
      input, textarea, select { background: #111; border-color: #333; border-radius: 8px; color: #f5f5f5; }
      input:focus, textarea:focus, select:focus { border-color: #8a8a8a; box-shadow: 0 0 0 3px rgba(255,255,255,.08); }
      button { border-radius: 8px; font-weight: 540; }
      button.primary { background: #f5f5f5; color: #111; }
      button.secondary { background: #2a2a2a; border: 1px solid #3a3a3a; color: #f5f5f5; }
      button.danger { background: #3a1f1f; border: 1px solid #5b2b2b; color: #ffd7d7; }
      .badge, .pill { background: #202020; border-color: #333; color: #d4d4d4; }
      .pill.active { border-color: #10a37f; color: #b5f4df; }
      .pill.revoked { border-color: #5b2b2b; color: #ffd7d7; }
      .ok { background: #13251f; border-color: #214638; border-left-color: #10a37f; color: #b5f4df; }
      .bad { background: #2a1818; border-color: #5b2b2b; border-left-color: #ef4444; color: #ffd7d7; }
      .meter, .progress { background: #111; }
      .meter > div, .progress div { background: #10a37f; }
      .hero-chart span, .sparkline span { background: #10a37f; opacity: .9; }
      .key-card:hover { border-color: #4a4a4a; box-shadow: none; transform: none; }
      .mobile-nav .nav-item { background: #202020; border-color: #303030; }
      @media (max-width: 640px) { .workspace { padding: 10px; } .topbar { border-radius: 12px; } .search { min-width: 0; } .content { margin-top: 14px; } }

      /* Density reduction and responsive polish */
      .shell { grid-template-columns: 228px minmax(0, 1fr); }
      .sidebar { padding: 16px 10px; }
      .brand-row { margin-bottom: 8px; }
      .side-card { display: none; }
      .workspace { padding: 20px 32px 56px; }
      .content { max-width: 1020px; }
      .page { min-height: calc(100vh - 150px); }
      .page > .card, .page > .two-col, .page.hero.active-page { margin-inline: auto; width: 100%; }
      .page.hero.active-page { grid-template-columns: minmax(0, .82fr) minmax(360px, .68fr); }
      .card, .intro { padding: 22px; }
      .card-head { margin-bottom: 18px; }
      .usage-grid { gap: 14px; }
      .usage-card, .stat, .endpoint, .activity-item, .chart-card, .key-card { padding: 16px; }
      .hero-chart { height: 48px; opacity: .55; }
      .sparkline { height: 42px; opacity: .7; }
      .analytics-strip { gap: 14px; }
      .docs-grid, .two-col, .split { gap: 18px; }
      .key-card { gap: 16px; }
      .topbar { padding: 12px 14px; }
      .status-badge { padding: 8px 10px; }
      .auth-actions { gap: 8px; }
      @media (max-width: 1180px) {
        .shell { grid-template-columns: 216px minmax(0, 1fr); }
        .workspace { padding-inline: 22px; }
        .content { max-width: 940px; }
        .page.hero.active-page { grid-template-columns: 1fr; }
      }
      @media (max-width: 980px) {
        body { padding-bottom: 72px; }
        .workspace { padding: 12px 12px 82px; }
        .content { max-width: 100%; }
        .topbar { position: static; }
        .mobile-nav { background: rgba(23,23,23,.96); border: 1px solid #303030; border-radius: 16px; bottom: 10px; box-shadow: 0 14px 30px rgba(0,0,0,.28); display: flex; left: 10px; margin: 0; padding: 8px; position: fixed; right: 10px; z-index: 20; }
        .mobile-nav .nav-item { border: 0; justify-content: center; padding: 10px 12px; }
      }
      @media (max-width: 760px) {
        .topbar-left { gap: 10px; }
        .status-badge, .icon-btn { display: none; }
        .search { min-width: 0; width: 100%; }
        .auth-actions { align-items: stretch; width: 100%; }
        .user-card { min-width: 0; }
      }
      @media (max-width: 520px) {
        .workspace { padding-inline: 8px; }
        .card, .intro { padding: 16px; }
        .card-head { align-items: flex-start; flex-direction: column; }
        .usage-card strong { font-size: 18px; }
        .mobile-nav .nav-item { font-size: 13px; padding-inline: 10px; }
        #userEmail { display: none; }
      }

      /* Senior UX reset: focused API-console layout */
      .content > .page:not(.active-page) { display: none !important; }
      .content > .page.active-page { display: block !important; }
      .content > .page.hero.active-page { display: grid !important; }
      body:not(.signed-in) .content > .page:not(#overview) { display: none !important; }
      body:not(.signed-in) .auth-required { opacity: .45; pointer-events: none; }
      body:not(.signed-in) .nav-item:not([data-nav="overview"]) { opacity: .46; }
      .admin-only { display: none !important; }
      body.admin-user .admin-only { display: flex !important; }
      body.admin-user section.admin-only { display: block !important; }
      .workspace { padding-top: 16px; }
      .topbar { margin: 0 auto; max-width: 1120px; width: 100%; }
      .content { max-width: 1120px; }
      .page { min-height: auto; }
      .card, .intro { background: #181818; }
      .card { margin-bottom: 18px; }
      .intro { min-height: 0; }
      .hero-chart { display: none; }
      .page#overview > .card:first-child { padding: 28px; }
      .page#overview h1 { max-width: 760px; }
      .page#overview .usage-grid { margin-top: 22px; }
      .usage-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .two-col { align-items: stretch; grid-template-columns: minmax(0, 1fr) 360px; }
      .activity-item { min-height: 64px; }
      .page.hero.active-page { align-items: start; grid-template-columns: minmax(0, 1fr) 420px; }
      .page.hero.active-page > .intro { order: 1; }
      .page.hero.active-page > .card:not(.panel) { order: 2; }
      .page.hero.active-page > .card.panel { order: 3; }
      .key-card { max-width: 100%; }
      .topbar-left { flex: 1; }
      .auth-actions { flex-shrink: 0; }
      .search { max-width: 360px; }
      .sidebar { width: 100%; }
      .nav-item.active { position: relative; }
      .nav-item.active:before { background: #ececec; border-radius: 999px; content: ""; height: 18px; left: 10px; position: absolute; width: 3px; }
      .nav-dot { display: none; }
      .nav-item { padding-left: 18px; }
      @media (max-width: 1180px) {
        .topbar, .content { max-width: 100%; }
        .two-col, .page.hero.active-page { grid-template-columns: 1fr; }
      }
      @media (max-width: 760px) {
        .topbar { gap: 12px; }
        .crumbs { font-size: 13px; }
        .page#overview > .card:first-child { padding: 20px; }
        .usage-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .workflow-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 520px) {
        .usage-grid { grid-template-columns: 1fr; }
        .workflow-steps, .copy-row { grid-template-columns: 1fr; }
        .auth-actions { gap: 6px; }
        #signOutBtn, #googleSignInBtn { min-height: 40px; }
      }
    </style>
  </head>
  <body class="auth-loading">
    <main class="shell">
      <aside class="sidebar">
        <div class="brand-row">
          <div class="brand-mark">CL</div>
          <div>
            <div class="brand-title">Cricket Live</div>
            <div class="brand-sub">Developer Console</div>
          </div>
        </div>
        <nav class="nav">
          <a class="nav-item active" data-nav="overview" href="#overview"><span class="nav-dot"></span> Overview</a>
          <a class="nav-item" data-nav="keys" href="#keys"><span class="nav-dot"></span> API Keys</a>
          <a class="nav-item" data-nav="analytics" href="#analytics"><span class="nav-dot"></span> Analytics</a>
          <a class="nav-item" data-nav="logs" href="#logs"><span class="nav-dot"></span> Logs</a>
          <a class="nav-item" data-nav="playground" href="#playground"><span class="nav-dot"></span> Playground</a>
          <a class="nav-item admin-only" data-nav="approvals" href="#approvals"><span class="nav-dot"></span> Approvals</a>
          <a class="nav-item" data-nav="webhooks" href="#webhooks"><span class="nav-dot"></span> Webhooks</a>
          <a class="nav-item" data-nav="billing" href="#billing"><span class="nav-dot"></span> Billing</a>
          <a class="nav-item" data-nav="team" href="#team"><span class="nav-dot"></span> Team</a>
          <a class="nav-item" data-nav="embed" href="#embed"><span class="nav-dot"></span> Embed widget</a>
          <a class="nav-item" data-nav="docs" href="#docs"><span class="nav-dot"></span> API docs</a>
          <a class="nav-item" data-nav="revoke" href="#revoke"><span class="nav-dot"></span> Revoke key</a>
          <a class="nav-item" data-nav="settings" href="#settings"><span class="nav-dot"></span> Settings</a>
        </nav>
        <div class="side-card">
          <p class="fine">Free mode active</p>
          <h2 style="margin-top: 4px;">Live scores API</h2>
          <p class="muted">Google sign-in and simple copy-paste widget keys.</p>
        </div>
      </aside>

      <section class="workspace">
        <header class="topbar">
          <div class="topbar-left">
            <div id="crumbs" class="crumbs">Developer Console / Overview</div>
            <label class="search" aria-label="Search">
              <span>/</span>
              <input id="portalSearch" placeholder="Search keys, docs..." />
            </label>
          </div>
          <div class="auth-actions">
            <div id="authSkeleton" class="skeleton skeleton-button"></div>
            <span class="status-badge"><span class="pulse"></span> API Online</span>
            <div id="userCard" class="user-card" hidden>
              <img id="userPhoto" class="avatar" alt="" hidden />
              <div id="userInitial" class="avatar placeholder">U</div>
              <div>
                <div id="userName" class="brand-title">Signed in</div>
                <div id="userEmail" class="brand-sub"></div>
              </div>
            </div>
            <button id="googleSignInBtn" type="button">Continue with Google</button>
            <button id="signOutBtn" class="secondary" type="button" hidden>Sign out</button>
          </div>
        </header>
        <nav class="mobile-nav">
          <a class="nav-item active" data-nav="overview" href="#overview">Overview</a>
          <a class="nav-item" data-nav="keys" href="#keys">Keys</a>
          <a class="nav-item" data-nav="analytics" href="#analytics">Analytics</a>
          <a class="nav-item" data-nav="playground" href="#playground">Playground</a>
          <a class="nav-item admin-only" data-nav="approvals" href="#approvals">Approvals</a>
          <a class="nav-item" data-nav="embed" href="#embed">Embed</a>
          <a class="nav-item" data-nav="docs" href="#docs">Docs</a>
          <a class="nav-item" data-nav="revoke" href="#revoke">Revoke</a>
        </nav>

        <div class="content">
          <section id="overview" class="page active-page">
            <div class="card">
              <div class="card-head">
                <div>
                  <p class="eyebrow">Cricket Live Command</p>
                  <h1>Developer platform for live cricket data</h1>
                  <p class="muted">Build widgets, apps, dashboards, and live score experiences from one API surface.</p>
                </div>
                <span class="status-badge"><span class="pulse"></span> Live data healthy</span>
              </div>
              <div class="usage-grid">
                <div class="usage-card"><span>Total API calls</span><strong id="heroCalls">--</strong></div>
                <div class="usage-card"><span>Active API keys</span><strong id="heroKeys">--</strong></div>
                <div class="usage-card"><span>Monthly quota</span><strong id="overviewQuota">--</strong></div>
                <div class="usage-card"><span>Current uptime</span><strong>99.9%</strong></div>
              </div>
              <div class="hero-chart" aria-hidden="true">
                <span style="height: 34%;"></span><span style="height: 56%;"></span><span style="height: 42%;"></span><span style="height: 72%;"></span><span style="height: 50%;"></span><span style="height: 88%;"></span><span style="height: 64%;"></span><span style="height: 78%;"></span>
              </div>
            </div>
            <div class="two-col panel">
              <div class="card">
                <div class="card-head"><div><h2>Recent activity</h2><p class="muted">Latest platform events.</p></div></div>
                <div class="activity-list">
                  <div class="activity-item"><span class="activity-dot"></span><div><strong>API status checked</strong><div class="fine">System healthy</div></div></div>
                  <div class="activity-item"><span class="activity-dot"></span><div><strong>Usage synced</strong><div class="fine">Updates every few seconds after sign-in</div></div></div>
                  <div class="activity-item"><span class="activity-dot"></span><div><strong>Widget SDK ready</strong><div class="fine">Copy-paste embed available</div></div></div>
                </div>
              </div>
              <div class="card">
                <div class="card-head"><div><h2>Quick actions</h2><p class="muted">Jump into common workflows.</p></div></div>
                <div class="key-actions">
                  <button class="primary" type="button" data-nav="keys">Generate key</button>
                  <button class="secondary" type="button" data-nav="playground">Open playground</button>
                  <button class="secondary" type="button" data-nav="docs">View docs</button>
                </div>
              </div>
            </div>
          </section>

          <section id="keys" class="page hero">
            <div class="intro">
              <div>
                <p class="eyebrow">Cricket Live Command</p>
                <h1>API keys</h1>
                <p>Create and manage keys for the live score widget. Use the <code>x-api-key</code> header for direct API calls.</p>
              </div>
              <div class="stats">
                <div class="stat"><strong>Google</strong><span>Sign-in gate</span></div>
                <div class="stat"><strong>Email</strong><span>Verified owner</span></div>
                <div class="stat"><strong>Rotate</strong><span>Revoke anytime</span></div>
              </div>
            </div>

            <div class="card">
              <div class="auth-panel">
                <div class="auth-row">
                  <div>
                    <h2>Account access</h2>
              <p class="muted">Sign in with Google. The same Google email will own the API key.</p>
                  </div>
                  <span class="badge">Firebase Auth</span>
                </div>
                <p id="portalStatus" class="status">Sign in with Google to unlock API key generation.</p>
                <div class="skeleton-only" hidden>
                  <div class="skeleton skeleton-line"></div>
                </div>
              </div>

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
              Website domains for approval
              <textarea name="allowedOrigins" placeholder="example.com&#10;www.example.com" required></textarea>
              <span class="fine">One domain per line. The key stays pending until an administrator approves these domains.</span>
            </label>
            <button id="generateKeyBtn" class="primary" type="submit">Generate API key</button>
          </form>
          <div class="skeleton-only" hidden>
            <div class="skeleton skeleton-card" style="margin-bottom:12px;"></div>
            <div class="skeleton skeleton-card" style="margin-bottom:12px;"></div>
            <div class="skeleton skeleton-button" style="width:100%;"></div>
          </div>

          <section id="result" class="result">
            <div class="result-title">Your API key</div>
            <textarea id="apiKey" readonly></textarea>
            <p id="quotaStatus" class="status">Copy it now. The full key is shown only once.</p>
            <div class="result-title">Domain verification</div>
            <div class="copy-row">
              <textarea id="verificationBox" readonly></textarea>
              <div class="key-actions">
                <button id="copyVerificationBtn" type="button" class="secondary">Copy</button>
                <button id="downloadVerificationBtn" type="button" class="secondary">Download file</button>
              </div>
            </div>
            <p class="status">Upload this content at <code>/cricket-live-verify.txt</code> on your website, then wait for admin approval.</p>
            <div class="actions">
              <button id="copyBtn" type="button" class="secondary">Copy key</button>
              <button id="testBtn" type="button">Test key</button>
            </div>
            <p id="testStatus" class="status"></p>
            <div class="result-title">Embed snippet</div>
            <textarea id="example" readonly></textarea>
          </section>
            </div>

          <div class="card panel">
            <div class="card-head">
              <div>
                <h2>Your API keys</h2>
                <p class="muted">Search, copy prefixes, view docs, or revoke keys.</p>
              </div>
              <span id="usageUpdatedAt" class="badge">Waiting</span>
            </div>
            <div id="keysTable" class="keys-table">
              <div class="empty-state">Sign in to load API keys.</div>
            </div>
          </div>
          </section>

      <section id="embed" class="page">
        <div class="card">
          <div class="card-head">
            <div>
              <h2>Embed widget</h2>
              <p class="muted">Paste this snippet in any website. Replace YOUR_API_KEY with your active key.</p>
            </div>
            <span class="badge">Copy paste</span>
          </div>
          <div class="split">
            <div>
              <textarea id="embedTemplate" readonly></textarea>
              <div class="control-grid">
                <label>Theme<select><option>Light</option><option>Dark</option></select></label>
                <label>Size<select><option>Responsive</option><option>Compact</option></select></label>
                <label>Refresh<select><option>30 seconds</option><option>60 seconds</option></select></label>
              </div>
            </div>
            <div class="preview-box">
              <div class="fine">Live widget preview</div>
              <div id="widgetPreview">Loading live cricket scores...</div>
            </div>
          </div>
          <p class="status">Generate an API key first, then replace the placeholder key in this snippet.</p>
        </div>
      </section>

      <section id="analytics" class="page">
        <div class="card">
          <div class="card-head">
            <div>
              <h2>Analytics</h2>
              <p class="muted">Request volume, quota, rate limit, and reliability signals.</p>
            </div>
            <span class="badge">Realtime</span>
          </div>
          <div class="usage-grid">
            <div class="usage-card"><span>Used this month</span><strong id="usageUsed">--</strong></div>
            <div class="usage-card"><span>Remaining</span><strong id="usageRemaining">--</strong></div>
            <div class="usage-card"><span>Monthly quota</span><strong id="usageQuota">--</strong></div>
            <div class="usage-card"><span>Rate limit</span><strong id="usageRateLimit">--</strong></div>
          </div>
          <div id="usageSkeleton" class="skeleton-only" hidden>
            <div class="usage-grid">
              <div class="skeleton skeleton-card"></div>
              <div class="skeleton skeleton-card"></div>
              <div class="skeleton skeleton-card"></div>
              <div class="skeleton skeleton-card"></div>
            </div>
          </div>
          <div class="meter"><div id="usageMeter"></div></div>
          <div class="analytics-strip">
            <div class="chart-card">
              <div class="fine">Requests trend</div>
              <div class="sparkline"><span style="height:28%;"></span><span style="height:54%;"></span><span style="height:40%;"></span><span style="height:70%;"></span><span style="height:62%;"></span><span style="height:86%;"></span></div>
            </div>
            <div class="chart-card">
              <div class="fine">Rate limit health</div>
              <div class="sparkline"><span style="height:76%;"></span><span style="height:66%;"></span><span style="height:58%;"></span><span style="height:48%;"></span><span style="height:42%;"></span><span style="height:36%;"></span></div>
            </div>
            <div class="chart-card">
              <div class="fine">Error rate</div>
              <div class="sparkline"><span style="height:20%;"></span><span style="height:14%;"></span><span style="height:24%;"></span><span style="height:12%;"></span><span style="height:18%;"></span><span style="height:10%;"></span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="logs" class="page">
        <div class="card">
          <div class="card-head"><div><h2>Request logs</h2><p class="muted">Terminal-inspired request history. Live logs will appear here as traffic comes in.</p></div><span class="badge">Logs</span></div>
          <div id="requestLogs" class="activity-list">
            <div class="empty-state">Sign in to load request logs.</div>
          </div>
        </div>
      </section>

      <section id="playground" class="page">
        <div class="card">
          <div class="card-head"><div><h2>API playground</h2><p class="muted">Run real API requests with your approved key, inspect response headers, and copy code.</p></div><span class="badge">Interactive</span></div>
          <div class="split">
            <div>
              <label>API key<textarea id="playgroundKey" placeholder="Paste an approved cricket_live_ key"></textarea></label>
              <label>Endpoint<select id="playgroundEndpoint"><option value="/api/v1/live-match">GET /api/v1/live-match</option><option value="/api/v1/matches">GET /api/v1/matches</option><option value="/api/v1/series/ipl-2026">GET /api/v1/series/ipl-2026</option><option value="/api/v1/score/:matchId">GET /api/v1/score/:matchId</option><option value="/api/v1/commentary/:matchId">GET /api/v1/commentary/:matchId</option></select></label>
              <label id="matchIdField" hidden>Match ID<input id="playgroundMatchId" placeholder="Paste match id" /></label>
              <div class="panel actions"><button id="sendPlaygroundBtn" class="primary" type="button">Send request</button><button id="copyPlaygroundCurlBtn" class="secondary" type="button">Copy cURL</button></div>
              <p id="playgroundStatus" class="status">Approved keys can be tested here. Pending keys will return an approval warning.</p>
            </div>
            <pre id="playgroundResponse" class="code-block">Select an endpoint and send a request.</pre>
          </div>
        </div>
      </section>

      <section id="approvals" class="page admin-only">
        <div class="card">
          <div class="card-head">
            <div>
              <h2>Domain approvals</h2>
              <p class="muted">Administrator queue for AdSense-style domain verification. Keys cannot call the API until approved.</p>
            </div>
            <span class="badge">Admin</span>
          </div>
          <div class="workflow-steps">
            <div class="workflow-step"><strong>1. Key</strong><span class="fine">User generates and copies API key.</span></div>
            <div class="workflow-step"><strong>2. Domain</strong><span class="fine">User submits website domains.</span></div>
            <div class="workflow-step"><strong>3. Verify</strong><span class="fine">User uploads verification file.</span></div>
            <div class="workflow-step"><strong>4. Approve</strong><span class="fine">Admin approves or rejects access.</span></div>
          </div>
          <div id="approvalList" class="keys-table">
            <div class="empty-state">Admin access required.</div>
          </div>
        </div>
      </section>

      <section id="docs" class="page">
        <div class="card">
          <div class="card-head">
            <div>
              <h2>API docs</h2>
              <p class="muted">Complete integration guide for approved Cricket Live developer keys.</p>
            </div>
            <span class="badge">v1</span>
          </div>
          <div class="workflow-steps">
            <div class="workflow-step"><strong>Generate</strong><span class="fine">Create a key and save the full key immediately.</span></div>
            <div class="workflow-step"><strong>Verify</strong><span class="fine">Upload <code>cricket-live-verify.txt</code> to your site root.</span></div>
            <div class="workflow-step"><strong>Approval</strong><span class="fine">Wait for administrator approval.</span></div>
            <div class="workflow-step"><strong>Use</strong><span class="fine">Send <code>x-api-key</code> from the approved domain.</span></div>
          </div>
          <pre class="code-block">curl -H "x-api-key: YOUR_API_KEY" "${_request.protocol}://${_request.get("host")}/api/v1/live-match"</pre>
          <div class="docs-grid">
            <div class="endpoint">
              <code>GET /api/v1/matches</code>
              <p>Returns live, upcoming, and recent matches. Use this to build match lists and schedules.</p>
            </div>
            <div class="endpoint">
              <code>GET /api/v1/live-match</code>
              <p>Returns the current active live match, including team names, match id, venue, and embedded score summary when available.</p>
            </div>
            <div class="endpoint">
              <code>GET /api/v1/score/:matchId</code>
              <p>Returns the latest detailed score for one match id. Use match ids from <code>/api/v1/matches</code> or <code>/api/v1/live-match</code>.</p>
            </div>
            <div class="endpoint">
              <code>GET /api/v1/commentary/:matchId</code>
              <p>Returns recent commentary for one match when commentary is available from the provider.</p>
            </div>
            <div class="endpoint">
              <code>GET /api/v1/series/ipl-2026</code>
              <p>Returns IPL series data such as matches, squads, table data, and local assets.</p>
            </div>
            <div class="endpoint">
              <code>Headers</code>
              <p>Every protected response includes quota and rate-limit headers: <code>x-api-quota-limit</code>, <code>x-api-quota-used</code>, <code>x-api-quota-remaining</code>, and <code>x-api-key-rate-limit-remaining</code>.</p>
            </div>
            <div class="endpoint">
              <code>403 approval errors</code>
              <p><code>API key is waiting for administrator approval</code> means the domain request is pending. <code>This API key is not allowed from this domain</code> means the request came from an unapproved domain.</p>
            </div>
            <div class="endpoint">
              <code>Widget embed</code>
              <p>Use the Embed widget page after approval. The widget uses the same key and must run from an approved website domain.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="webhooks" class="page">
        <div class="card">
          <div class="card-head"><div><h2>Webhooks</h2><p class="muted">Create endpoints for score updates, match starts, wickets, and results.</p></div><span class="badge">Soon</span></div>
          <div class="empty-state">Webhook endpoints and delivery history will be managed here.</div>
        </div>
      </section>

      <section id="billing" class="page">
        <div class="card">
          <div class="card-head"><div><h2>Billing</h2><p class="muted">Free mode is active. Paid plans can unlock higher quotas later.</p></div><span class="badge">Free</span></div>
          <div class="usage-grid">
            <div class="usage-card"><span>Plan</span><strong>Free</strong></div>
            <div class="usage-card"><span>Invoices</span><strong>0</strong></div>
            <div class="usage-card"><span>Team seats</span><strong>1</strong></div>
            <div class="usage-card"><span>SLA</span><strong>Community</strong></div>
          </div>
        </div>
      </section>

      <section id="team" class="page">
        <div class="card">
          <div class="card-head"><div><h2>Team</h2><p class="muted">Invite developers, assign roles, and track activity.</p></div><span class="badge">Solo</span></div>
          <div class="empty-state">Team collaboration can be enabled when paid plans are added.</div>
        </div>
      </section>

      <section id="revoke" class="page">
        <div class="card">
          <div class="card-head">
            <div>
              <h2>Revoke leaked key</h2>
              <p class="muted">Sign in with Google, then revoke all active keys or one key prefix.</p>
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
            <button type="submit" class="danger">Revoke key</button>
          </form>
        </div>
      </section>

      <section id="settings" class="page">
        <div class="card">
          <div class="card-head"><div><h2>Settings</h2><p class="muted">Profile, security, notifications, API defaults, and appearance.</p></div><span class="badge">Console</span></div>
          <div class="docs-grid">
            <div class="endpoint"><h2>Security</h2><p>Google sign-in, token verification, rate limits, and key revocation are enabled.</p></div>
            <div class="endpoint"><h2>Appearance</h2><p>Dark mode is optimized for developer workflows.</p></div>
          </div>
        </div>
      </section>
        </div>
      </section>
    </main>

    <script type="module">
      import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
      import { getAuth, GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

      const firebaseConfig = {
        apiKey: "AIzaSyDqmvvnLzaRTdlRRXlqxbWkCa1cludK4_s",
        authDomain: "cricketapi-14e90.firebaseapp.com",
        projectId: "cricketapi-14e90",
        storageBucket: "cricketapi-14e90.firebasestorage.app",
        messagingSenderId: "1021887715221",
        appId: "1:1021887715221:web:c0e3da34a1c9877c6f089c",
        measurementId: "G-H0DCN7VQWL"
      };

      const firebaseApp = initializeApp(firebaseConfig);
      const auth = getAuth(firebaseApp);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const adminConsolePath = ${JSON.stringify(`/api/developer/${env.API_ADMIN_CONSOLE_PATH}`)};
      if (location.pathname === adminConsolePath && !location.hash) {
        location.hash = "approvals";
      }
      const form = document.getElementById("keyForm");
      const revokeForm = document.getElementById("revokeForm");
      const result = document.getElementById("result");
      const apiKeyBox = document.getElementById("apiKey");
      const verificationBox = document.getElementById("verificationBox");
      const exampleBox = document.getElementById("example");
      const embedTemplate = document.getElementById("embedTemplate");
      const testStatus = document.getElementById("testStatus");
      const portalStatus = document.getElementById("portalStatus");
      const quotaStatus = document.getElementById("quotaStatus");
      const googleSignInBtn = document.getElementById("googleSignInBtn");
      const signOutBtn = document.getElementById("signOutBtn");
      const userCard = document.getElementById("userCard");
      const userName = document.getElementById("userName");
      const userEmail = document.getElementById("userEmail");
      const userPhoto = document.getElementById("userPhoto");
      const userInitial = document.getElementById("userInitial");
      const usageUsed = document.getElementById("usageUsed");
      const usageRemaining = document.getElementById("usageRemaining");
      const usageQuota = document.getElementById("usageQuota");
      const usageRateLimit = document.getElementById("usageRateLimit");
      const usageMeter = document.getElementById("usageMeter");
      const usageUpdatedAt = document.getElementById("usageUpdatedAt");
      const keysTable = document.getElementById("keysTable");
      const heroCalls = document.getElementById("heroCalls");
      const heroKeys = document.getElementById("heroKeys");
      const overviewQuota = document.getElementById("overviewQuota");
      const portalSearch = document.getElementById("portalSearch");
      const crumbs = document.getElementById("crumbs");
      const requestLogs = document.getElementById("requestLogs");
      const approvalList = document.getElementById("approvalList");
      const playgroundKey = document.getElementById("playgroundKey");
      const playgroundEndpoint = document.getElementById("playgroundEndpoint");
      const playgroundMatchId = document.getElementById("playgroundMatchId");
      const matchIdField = document.getElementById("matchIdField");
      const sendPlaygroundBtn = document.getElementById("sendPlaygroundBtn");
      const copyPlaygroundCurlBtn = document.getElementById("copyPlaygroundCurlBtn");
      const playgroundStatus = document.getElementById("playgroundStatus");
      const playgroundResponse = document.getElementById("playgroundResponse");
      const gatedControls = Array.from(document.querySelectorAll("#keyForm input, #keyForm textarea, #keyForm button, #revokeForm input, #revokeForm button"));
      const createEmailInput = form.elements.email;
      const revokeEmailInput = revokeForm.elements.email;
      let currentKey = "";
      let currentUser = null;
      let currentUserIsAdmin = false;
      let usageTimer = 0;

      embedTemplate.value = '<div id="cricket-live-widget">Loading live cricket scores...</div>\\n' +
        '<script async src="' + window.location.origin + '/api/developer/widget.js" data-api-key="YOUR_API_KEY" data-target="cricket-live-widget" data-refresh="30000"><\\/script>';

      function setStatus(message, type) {
        portalStatus.className = "status" + (type ? " " + type : "");
        portalStatus.textContent = message;
      }

      function setFormsEnabled(enabled) {
        gatedControls.forEach((control) => {
          control.disabled = !enabled;
        });
      }

      function formatNumber(value) {
        return Number(value || 0).toLocaleString();
      }

      function formatDate(value) {
        return value ? new Date(value).toLocaleString() : "--";
      }

      function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
      }

      async function fetchUsage() {
        if (!currentUser) return;
        const firebaseIdToken = await currentUser.getIdToken();
        const response = await fetch("/api/developer/api-keys/me", {
          headers: { Authorization: "Bearer " + firebaseIdToken },
          cache: "no-store"
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load usage");
        renderUsage(payload.data);
      }

      function renderUsage(data) {
        currentUserIsAdmin = Boolean(data.isAdmin);
        document.body.classList.toggle("admin-user", currentUserIsAdmin);
        const used = Number(data.emailUsageCount || 0);
        const quota = Number(data.monthlyQuota || 0);
        const remaining = Math.max(Number(data.remaining || 0), 0);
        usageUsed.textContent = formatNumber(used);
        usageRemaining.textContent = formatNumber(remaining);
        usageQuota.textContent = formatNumber(quota);
        overviewQuota.textContent = formatNumber(quota);
        usageRateLimit.textContent = formatNumber(data.rateLimit?.limit) + "/min";
        heroCalls.textContent = formatNumber(used);
        heroKeys.textContent = formatNumber(data.activeKeyCount || 0);
        usageMeter.style.width = quota > 0 ? Math.min((used / quota) * 100, 100).toFixed(1) + "%" : "0%";
        usageUpdatedAt.textContent = "Updated " + new Date().toLocaleTimeString();
        const rows = Array.isArray(data.keys) ? data.keys : [];
        keysTable.innerHTML = rows.length ? rows.map((key) => {
            const statusClass = key.revoked ? "revoked" : "active";
            const approval = key.approvalStatus || "pending";
            const statusText = key.revoked ? "Revoked" : approval.charAt(0).toUpperCase() + approval.slice(1);
            const percent = key.monthlyQuota > 0 ? Math.min((Number(key.usageCount || 0) / Number(key.monthlyQuota || 1)) * 100, 100).toFixed(1) : "0";
            const action = key.revoked ? '<span class="fine">Archived</span>' : '<button class="secondary tiny" type="button" data-copy-prefix="' + escapeHtml(key.keyPrefix) + '">Copy</button><button class="danger tiny" type="button" data-delete-key="' + escapeHtml(key.keyPrefix) + '">Revoke</button>';
            return '<div class="key-card" data-key-card data-search="' + escapeHtml((key.name || "") + " " + (key.keyPrefix || "")) + '">' +
              '<div class="key-card-top">' +
                '<div><div class="key-prefix">' + escapeHtml(key.keyPrefix) + '</div><div class="fine">' + escapeHtml(key.name || "Cricket app") + '</div><div class="fine">Requested: ' + escapeHtml((key.requestedDomains || []).join(", ") || "--") + '</div><div class="fine">Approved: ' + escapeHtml((key.approvedDomains || []).join(", ") || "--") + '</div></div>' +
                '<span class="pill ' + (approval === "approved" ? "active" : approval === "rejected" ? "revoked" : "") + '">' + statusText + '</span>' +
              '</div>' +
              (approval === "pending" ? '<div class="status">Upload <code>/cricket-live-verify.txt</code> with:<br><code>' + escapeHtml(key.verificationToken || "") + '</code><br>Admin approval is required before this key can call the API.</div><button class="secondary tiny" type="button" data-download-verification="' + escapeHtml(key.verificationToken || "") + '">Download verification file</button>' : '') +
              (approval === "rejected" ? '<div class="status bad">' + escapeHtml(key.rejectionReason || "Rejected by administrator") + '</div>' : '') +
              '<div><div class="fine">Usage ' + formatNumber(key.usageCount) + ' / ' + formatNumber(key.monthlyQuota) + '</div><div class="progress"><div style="width:' + percent + '%"></div></div></div>' +
              '<div class="key-card-meta">' +
                '<div>Created<br><strong>' + escapeHtml(formatDate(key.createdAt)) + '</strong></div>' +
                '<div>Last used<br><strong>' + escapeHtml(formatDate(key.lastUsedAt)) + '</strong></div>' +
              '</div>' +
              '<div class="key-actions">' + action + '<button class="secondary tiny" type="button" data-nav="docs">View docs</button></div>' +
            '</div>';
          }).join("") : '<div class="empty-state">No API keys yet. Generate your first key from the dashboard card.</div>';

        const logs = Array.isArray(data.recentLogs) ? data.recentLogs : [];
        requestLogs.innerHTML = logs.length ? logs.map((log) => {
          const ok = Number(log.status) < 400;
          return '<div class="activity-item">' +
            '<span class="activity-dot" style="background:' + (ok ? '#22c55e' : '#ef4444') + '"></span>' +
            '<div><code>' + escapeHtml(log.method) + ' ' + escapeHtml(log.path) + '</code>' +
            '<div class="fine">' + escapeHtml(log.status + " " + (log.message || "")) + ' · ' + escapeHtml(log.origin || "no origin") + ' · ' + escapeHtml(formatDate(log.createdAt)) + '</div></div>' +
          '</div>';
        }).join("") : '<div class="empty-state">No API key traffic yet. Test a key from the playground or widget.</div>';
        if (currentUserIsAdmin) {
          void fetchApprovals().catch((error) => {
            approvalList.innerHTML = '<div class="empty-state">' + escapeHtml(error.message || "Could not load approvals") + '</div>';
          });
        } else {
          approvalList.innerHTML = '<div class="empty-state">Administrator access required. Add your email to <code>API_ADMIN_EMAILS</code>.</div>';
        }
      }

      async function fetchApprovals() {
        if (!currentUser || !currentUserIsAdmin) return;
        const firebaseIdToken = await currentUser.getIdToken();
        const response = await fetch("/api/developer/api-keys/approvals", {
          headers: { Authorization: "Bearer " + firebaseIdToken },
          cache: "no-store"
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load approvals");
        renderApprovals(payload.data.requests || []);
      }

      function renderApprovals(requests) {
        approvalList.innerHTML = requests.length ? requests.map((item) => {
          const status = item.approvalStatus || "pending";
          return '<div class="approval-card ' + escapeHtml(status) + '">' +
            '<div class="key-card-top"><div><div class="key-prefix">' + escapeHtml(item.keyPrefix) + '</div><div class="fine">' + escapeHtml(item.name || "Cricket app") + ' · ' + escapeHtml(item.email) + '</div></div><span class="pill ' + (status === "approved" ? "active" : status === "rejected" ? "revoked" : "") + '">' + escapeHtml(status) + '</span></div>' +
            '<div class="docs-grid">' +
              '<div class="endpoint"><code>Requested domains</code><p>' + escapeHtml((item.requestedDomains || []).join(", ") || "--") + '</p><p class="fine">' + (item.requestedDomains || []).map((domain) => '<button class="secondary tiny" type="button" data-verify-domain="' + escapeHtml(domain) + '" data-verify-key="' + escapeHtml(item.keyPrefix) + '">Check ' + escapeHtml(domain) + '</button>').join(" ") + '</p></div>' +
              '<div class="endpoint"><code>Verification file</code><p>/' + 'cricket-live-verify.txt<br><strong>' + escapeHtml(item.verificationToken || "") + '</strong></p></div>' +
            '</div>' +
            '<div class="key-actions">' +
              '<button class="primary tiny" type="button" data-approve-key="' + escapeHtml(item.keyPrefix) + '">Approve</button>' +
              '<button class="danger tiny" type="button" data-reject-key="' + escapeHtml(item.keyPrefix) + '">Reject</button>' +
            '</div>' +
          '</div>';
        }).join("") : '<div class="empty-state">No approval requests yet.</div>';
      }

      function resetUsage() {
        usageUsed.textContent = "--";
        usageRemaining.textContent = "--";
        usageQuota.textContent = "--";
        overviewQuota.textContent = "--";
        usageRateLimit.textContent = "--";
        heroCalls.textContent = "--";
        heroKeys.textContent = "--";
        usageMeter.style.width = "0%";
        usageUpdatedAt.textContent = "Waiting";
        keysTable.innerHTML = '<div class="empty-state">Sign in to load API keys.</div>';
        requestLogs.innerHTML = '<div class="empty-state">Sign in to load request logs.</div>';
        approvalList.innerHTML = '<div class="empty-state">Admin access required.</div>';
        currentUserIsAdmin = false;
      }

      function syncSignedInUser(user) {
        document.body.classList.remove("auth-loading");
        document.body.classList.add("auth-ready");
        currentUser = user || null;
        const signedIn = Boolean(user);
        document.body.classList.toggle("signed-in", signedIn);
        document.body.classList.remove("admin-user");
        setFormsEnabled(signedIn);
        googleSignInBtn.hidden = signedIn;
        signOutBtn.hidden = !signedIn;
        userCard.hidden = !signedIn;
        if (!signedIn) {
          createEmailInput.value = "";
          revokeEmailInput.value = "";
          createEmailInput.readOnly = false;
          revokeEmailInput.readOnly = false;
          result.classList.remove("visible");
          if (currentSectionFromHash() !== "overview") {
            location.hash = "overview";
          }
          clearInterval(usageTimer);
          usageTimer = 0;
          resetUsage();
          setStatus("Sign in with Google to unlock API key generation.");
          return;
        }
        const email = user.email || "";
        const name = user.displayName || "Developer";
        createEmailInput.value = email;
        revokeEmailInput.value = email;
        createEmailInput.readOnly = true;
        revokeEmailInput.readOnly = true;
        userName.textContent = name;
        userEmail.textContent = email;
        userInitial.textContent = (name || email || "U").trim().charAt(0).toUpperCase();
        if (user.photoURL) {
          userPhoto.src = user.photoURL;
          userPhoto.hidden = false;
          userInitial.hidden = true;
        } else {
          userPhoto.hidden = true;
          userInitial.hidden = false;
        }
        setStatus("Signed in as " + email + ". You can generate an API key now.", "ok");
        void fetchUsage().catch((error) => setStatus(error.message || "Could not load usage", "bad"));
        clearInterval(usageTimer);
        usageTimer = window.setInterval(() => {
          void fetchUsage().catch(() => {});
        }, 10000);
      }

      setFormsEnabled(false);
      resetUsage();
      onAuthStateChanged(auth, syncSignedInUser);

      function currentSectionFromHash() {
        const id = (location.hash || "#overview").replace("#", "");
        return ["overview", "keys", "analytics", "logs", "playground", "approvals", "webhooks", "billing", "team", "embed", "docs", "revoke", "settings"].includes(id) ? id : "overview";
      }

      function setActiveNav(id) {
        document.querySelectorAll("[data-nav]").forEach((link) => {
          link.classList.toggle("active", link.getAttribute("data-nav") === id);
        });
        const labels = { overview: "Overview", keys: "API Keys", analytics: "Analytics", logs: "Logs", playground: "Playground", approvals: "Approvals", webhooks: "Webhooks", billing: "Billing", team: "Team", embed: "Embed Widget", docs: "Documentation", revoke: "Revoke Key", settings: "Settings" };
        crumbs.textContent = "Developer Console / " + (labels[id] || "Overview");
      }

      function showCurrentSection() {
        const id = currentSectionFromHash();
        if (!currentUser && id !== "overview") {
          location.hash = "overview";
          setStatus("Sign in with Google to unlock this section.", "bad");
          return;
        }
        if (id === "approvals" && !currentUserIsAdmin) {
          location.hash = "overview";
          setStatus("Administrator access is required.", "bad");
          return;
        }
        setActiveNav(id);
        document.querySelectorAll(".page").forEach((section) => {
          section.classList.toggle("active-page", section.id === id);
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      document.querySelectorAll("[data-nav]").forEach((link) => {
        link.addEventListener("click", () => {
          window.setTimeout(showCurrentSection, 0);
        });
      });
      document.addEventListener("click", (event) => {
        const navButton = event.target.closest("button[data-nav]");
        if (!navButton) return;
        location.hash = navButton.getAttribute("data-nav") || "overview";
        window.setTimeout(showCurrentSection, 0);
      });
      window.addEventListener("hashchange", showCurrentSection);
      setActiveNav(currentSectionFromHash());
      showCurrentSection();

      portalSearch.addEventListener("input", () => {
        const query = portalSearch.value.trim().toLowerCase();
        document.querySelectorAll("[data-key-card]").forEach((card) => {
          const text = (card.getAttribute("data-search") || "").toLowerCase();
          card.hidden = Boolean(query) && !text.includes(query);
        });
      });

      googleSignInBtn.addEventListener("click", async () => {
        googleSignInBtn.disabled = true;
        setStatus("Opening Google sign-in...");
        try {
          await signInWithPopup(auth, provider);
        } catch (error) {
          const message = String(error?.code || error?.message || "");
          if (message.includes("auth/unauthorized-domain")) {
            setStatus("Firebase Authorized domains mein " + location.hostname + " add karo, phir Google sign-in chalega.", "bad");
          } else if (message.includes("auth/popup-closed-by-user") || message.includes("auth/cancelled-popup-request")) {
            setStatus("Popup close ho gaya. Redirect sign-in try kar rahe hain...");
            await signInWithRedirect(auth, provider);
          } else {
            setStatus((error.message || "Google sign-in failed") + " Firebase mein Google provider, authorized domain, aur API key restriction check karo.", "bad");
          }
        } finally {
          googleSignInBtn.disabled = false;
        }
      });

      signOutBtn.addEventListener("click", async () => {
        await signOut(auth);
      });

      getRedirectResult(auth).catch((error) => {
        const message = String(error?.code || error?.message || "");
        if (message.includes("auth/unauthorized-domain")) {
          setStatus("Firebase Authorized domains mein " + location.hostname + " add karo.", "bad");
        } else {
          setStatus((error.message || "Google redirect sign-in failed") + " Firebase Auth settings check karo.", "bad");
        }
      });

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

      async function revokeKeyPrefix(keyPrefix) {
        if (!currentUser) {
          setStatus("Please sign in with Google first.", "bad");
          return;
        }
        const confirmed = window.confirm("Delete this API key? Existing widgets using this key will stop working.");
        if (!confirmed) return;
        setStatus("Deleting API key...");
        const firebaseIdToken = await currentUser.getIdToken();
        const payload = await postJson("/api/developer/api-keys/revoke", {
          email: currentUser.email,
          firebaseIdToken,
          keyPrefix
        });
        setStatus("Deleted " + payload.data.revoked + " API key.", "ok");
        await fetchUsage();
      }

      keysTable.addEventListener("click", async (event) => {
        const copyButton = event.target.closest("[data-copy-prefix]");
        if (copyButton) {
          await navigator.clipboard.writeText(copyButton.getAttribute("data-copy-prefix") || "");
          setStatus("Key prefix copied.", "ok");
          return;
        }
        const verificationButton = event.target.closest("[data-download-verification]");
        if (verificationButton) {
          downloadVerificationFile(verificationButton.getAttribute("data-download-verification") || "");
          setStatus("Verification file downloaded. Upload it to your website root.", "ok");
          return;
        }
        const button = event.target.closest("[data-delete-key]");
        if (!button) return;
        button.disabled = true;
        try {
          await revokeKeyPrefix(button.getAttribute("data-delete-key") || "");
        } catch (error) {
          setStatus(error.message || "Could not delete key", "bad");
        } finally {
          button.disabled = false;
        }
      });

      approvalList.addEventListener("click", async (event) => {
        const verifyButton = event.target.closest("[data-verify-domain]");
        if (verifyButton) {
          if (!currentUserIsAdmin) {
            setStatus("Administrator access is required.", "bad");
            return;
          }
          verifyButton.disabled = true;
          setStatus("Checking verification file...");
          try {
            const firebaseIdToken = await currentUser.getIdToken();
            const payload = await postJson("/api/developer/api-keys/approvals/verify", {
              firebaseIdToken,
              keyPrefix: verifyButton.getAttribute("data-verify-key") || "",
              domain: verifyButton.getAttribute("data-verify-domain") || ""
            });
            setStatus(payload.data.ok ? "Verification matched. You can approve this request." : "Verification failed: " + (payload.data.received || "file missing"), payload.data.ok ? "ok" : "bad");
          } catch (error) {
            setStatus(error.message || "Could not check verification file", "bad");
          } finally {
            verifyButton.disabled = false;
          }
          return;
        }
        const approveButton = event.target.closest("[data-approve-key]");
        const rejectButton = event.target.closest("[data-reject-key]");
        if (!approveButton && !rejectButton) return;
        if (!currentUserIsAdmin) {
          setStatus("Administrator access is required.", "bad");
          return;
        }
        const keyPrefix = (approveButton || rejectButton).getAttribute(approveButton ? "data-approve-key" : "data-reject-key") || "";
        const action = approveButton ? "approve" : "reject";
        const reason = action === "reject" ? window.prompt("Reason for rejection?", "Domain verification missing or invalid") || "" : "";
        const firebaseIdToken = await currentUser.getIdToken();
        const payload = await postJson("/api/developer/api-keys/approvals/review", { firebaseIdToken, keyPrefix, action, reason });
        setStatus("Approval updated: " + payload.data.approvalStatus, "ok");
        await fetchApprovals();
        await fetchUsage();
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!currentUser) {
          setStatus("Please sign in with Google first.", "bad");
          return;
        }
        const button = document.getElementById("generateKeyBtn");
        button.disabled = true;
        button.textContent = "Generating...";
        testStatus.textContent = "";

        try {
          const formData = new FormData(form);
          const firebaseIdToken = await currentUser.getIdToken();
          const payload = await postJson("/api/developer/api-keys", {
            name: formData.get("name"),
            email: formData.get("email"),
            allowedOrigins: formData.get("allowedOrigins"),
            firebaseIdToken
          });

          currentKey = payload.data.key;
          playgroundKey.value = currentKey;
          apiKeyBox.value = currentKey;
          verificationBox.value = payload.data.verificationToken || "";
          downloadVerificationFile(verificationBox.value);
          exampleBox.value = '<div id="cricket-live-widget">Loading live cricket scores...</div>\\n<script async src="' + location.origin + '/api/developer/widget.js" data-api-key="' + currentKey + '" data-target="cricket-live-widget" data-refresh="30000"><\\/script>';
          quotaStatus.className = "status ok";
          quotaStatus.textContent = "Copy it now. Status: pending admin approval. Limit: " + payload.data.monthlyQuota + " requests/month for this email.";
          result.classList.add("visible");
          setStatus("API key created successfully.", "ok");
          void fetchUsage().catch(() => {});
        } catch (error) {
          setStatus(error.message || "Could not generate API key", "bad");
        } finally {
          button.disabled = false;
          button.textContent = "Generate API key";
        }
      });

      revokeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!currentUser) {
          setStatus("Please sign in with Google first.", "bad");
          return;
        }
        const button = revokeForm.querySelector("button.danger");
        const formData = new FormData(revokeForm);
        button.disabled = true;
        setStatus("Revoking...");
        try {
          const firebaseIdToken = await currentUser.getIdToken();
          const payload = await postJson("/api/developer/api-keys/revoke", {
            email: formData.get("email"),
            firebaseIdToken,
            keyPrefix: formData.get("keyPrefix")
          });
          setStatus("Revoked " + payload.data.revoked + " active key(s).", "ok");
          void fetchUsage().catch(() => {});
        } catch (error) {
          setStatus(error.message || "Could not revoke key", "bad");
        } finally {
          button.disabled = false;
        }
      });

      document.getElementById("copyBtn").addEventListener("click", async () => {
        await navigator.clipboard.writeText(currentKey);
      });

      document.getElementById("copyVerificationBtn").addEventListener("click", async () => {
        await navigator.clipboard.writeText(verificationBox.value);
        setStatus("Verification token copied.", "ok");
      });

      function downloadVerificationFile(content) {
        if (!content.trim()) {
          setStatus("Generate a key first.", "bad");
          return;
        }
        const blob = new Blob([content.trim() + "\\n"], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "cricket-live-verify.txt";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      document.getElementById("downloadVerificationBtn").addEventListener("click", () => {
        downloadVerificationFile(verificationBox.value);
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

      function playgroundUrl() {
        let path = playgroundEndpoint.value;
        if (path.includes(":matchId")) {
          path = path.replace(":matchId", encodeURIComponent(playgroundMatchId.value.trim()));
        }
        return path;
      }

      playgroundEndpoint.addEventListener("change", () => {
        matchIdField.hidden = !playgroundEndpoint.value.includes(":matchId");
      });

      copyPlaygroundCurlBtn.addEventListener("click", async () => {
        const key = playgroundKey.value.trim() || "YOUR_API_KEY";
        await navigator.clipboard.writeText('curl -H "x-api-key: ' + key + '" "' + location.origin + playgroundUrl() + '"');
        playgroundStatus.className = "status ok";
        playgroundStatus.textContent = "cURL copied.";
      });

      sendPlaygroundBtn.addEventListener("click", async () => {
        const key = playgroundKey.value.trim();
        if (!key) {
          playgroundStatus.className = "status bad";
          playgroundStatus.textContent = "Paste an approved API key first.";
          return;
        }
        if (playgroundEndpoint.value.includes(":matchId") && !playgroundMatchId.value.trim()) {
          playgroundStatus.className = "status bad";
          playgroundStatus.textContent = "Match ID is required for this endpoint.";
          return;
        }
        sendPlaygroundBtn.disabled = true;
        playgroundStatus.className = "status";
        playgroundStatus.textContent = "Sending request...";
        try {
          const response = await fetch(playgroundUrl(), { headers: { "x-api-key": key }, cache: "no-store" });
          const payload = await response.json();
          const headers = {
            "x-api-plan": response.headers.get("x-api-plan"),
            "x-api-quota-limit": response.headers.get("x-api-quota-limit"),
            "x-api-quota-used": response.headers.get("x-api-quota-used"),
            "x-api-quota-remaining": response.headers.get("x-api-quota-remaining")
          };
          playgroundResponse.textContent = JSON.stringify({ status: response.status, ok: response.ok, headers, body: payload }, null, 2);
          playgroundStatus.className = "status " + (response.ok ? "ok" : "bad");
          playgroundStatus.textContent = response.ok ? "Request completed." : (payload.error || "Request failed");
          void fetchUsage().catch(() => {});
        } catch (error) {
          playgroundStatus.className = "status bad";
          playgroundStatus.textContent = error.message || "Request failed";
          playgroundResponse.textContent = String(error.message || error);
        } finally {
          sendPlaygroundBtn.disabled = false;
        }
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

  getMyApiKeys = async (request: Request, response: Response) => {
    const authorization = request.header("authorization") || "";
    const firebaseIdToken = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";

    if (!firebaseIdToken) {
      response.status(401).json({ error: "Google sign-in is required" });
      return;
    }

    try {
      const verifiedUser = await verifyFirebaseIdToken(firebaseIdToken);
      const result = await this.apiKeyService.listApiKeysForEmail(verifiedUser.email);
      response.json({ data: result });
    } catch (error) {
      this.sendApiKeyError(response, error, "API key usage is unavailable");
    }
  };

  getApprovalRequests = async (request: Request, response: Response) => {
    const authorization = request.header("authorization") || "";
    const firebaseIdToken = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";

    if (!firebaseIdToken) {
      response.status(401).json({ error: "Google sign-in is required" });
      return;
    }

    try {
      const verifiedUser = await verifyFirebaseIdToken(firebaseIdToken);
      const result = await this.apiKeyService.listApprovalRequests(verifiedUser.email);
      response.json({ data: result });
    } catch (error) {
      this.sendApiKeyError(response, error, "Approval requests are unavailable");
    }
  };

  createApiKey = async (request: Request, response: Response) => {
    const name = typeof request.body?.name === "string" ? request.body.name : "";
    const email = typeof request.body?.email === "string" ? request.body.email : "";
    const allowedOrigins = request.body?.allowedOrigins;
    const firebaseIdToken = typeof request.body?.firebaseIdToken === "string" ? request.body.firebaseIdToken : "";
    if (!name.trim() || !email.trim() || !firebaseIdToken.trim()) {
      response.status(400).json({ error: "Name, email and Google sign-in are required" });
      return;
    }

    let result;
    try {
      const verifiedUser = await verifyFirebaseIdToken(firebaseIdToken);
      if (verifiedUser.email !== email.trim().toLowerCase()) {
        response.status(403).json({ error: "Google account email does not match the submitted email" });
        return;
      }
      result = await this.apiKeyService.createApiKey({ name, email, allowedOrigins, verifiedByGoogle: true });
    } catch (error) {
      this.sendApiKeyError(response, error, "API key generation is unavailable");
      return;
    }

    response.status(201).json({
      data: result,
      message: "Copy this API key now. It will not be shown again."
    });
  };

  reviewApprovalRequest = async (request: Request, response: Response) => {
    const firebaseIdToken = typeof request.body?.firebaseIdToken === "string" ? request.body.firebaseIdToken : "";
    const keyPrefix = typeof request.body?.keyPrefix === "string" ? request.body.keyPrefix : "";
    const action = request.body?.action === "reject" ? "reject" : "approve";
    const reason = typeof request.body?.reason === "string" ? request.body.reason : undefined;

    if (!firebaseIdToken.trim() || !keyPrefix.trim()) {
      response.status(400).json({ error: "Google sign-in and key prefix are required" });
      return;
    }

    try {
      const verifiedUser = await verifyFirebaseIdToken(firebaseIdToken);
      const result = await this.apiKeyService.reviewApproval({ adminEmail: verifiedUser.email, keyPrefix, action, reason });
      response.json({ data: result, message: `API key ${result.approvalStatus}.` });
    } catch (error) {
      this.sendApiKeyError(response, error, "Approval review is unavailable");
    }
  };

  verifyApprovalDomain = async (request: Request, response: Response) => {
    const firebaseIdToken = typeof request.body?.firebaseIdToken === "string" ? request.body.firebaseIdToken : "";
    const keyPrefix = typeof request.body?.keyPrefix === "string" ? request.body.keyPrefix : "";
    const domain = typeof request.body?.domain === "string" ? request.body.domain : "";

    if (!firebaseIdToken.trim() || !keyPrefix.trim() || !domain.trim()) {
      response.status(400).json({ error: "Google sign-in, key prefix and domain are required" });
      return;
    }

    try {
      const verifiedUser = await verifyFirebaseIdToken(firebaseIdToken);
      const result = await this.apiKeyService.verifyApprovalDomain({ adminEmail: verifiedUser.email, keyPrefix, domain });
      response.json({ data: result, message: result.ok ? "Verification file matched." : "Verification file did not match." });
    } catch (error) {
      this.sendApiKeyError(response, error, "Domain verification is unavailable");
    }
  };

  createAdminSession = async (request: Request, response: Response) => {
    const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
    const password = typeof request.body?.password === "string" ? request.body.password : "";

    if (!env.API_ADMIN_LOGIN_EMAIL && !env.API_ADMIN_EMAILS.trim()) {
      response.status(503).json({ error: "Admin email is not configured" });
      return;
    }
    if (!env.API_ADMIN_PASSWORD_HASH || !env.API_ADMIN_SESSION_SECRET) {
      response.status(503).json({ error: "Admin password login is not configured" });
      return;
    }
    const token = createAdminTokenForPassword(email, password);
    if (!token) {
      response.status(401).json({ error: "Invalid admin email or password" });
      return;
    }

    response.json({
      data: {
        email,
        token,
        expiresInSeconds: 60 * 60 * 6
      }
    });
  };

  getAdminOverview = async (request: Request, response: Response) => {
    const adminEmail = this.getAdminEmailFromSession(request);
    if (!adminEmail) {
      response.status(401).json({ error: "Admin session is required" });
      return;
    }
    try {
      response.json({ data: await this.apiKeyService.getAdminOverview(adminEmail) });
    } catch (error) {
      this.sendApiKeyError(response, error, "Admin overview is unavailable");
    }
  };

  blockApiKey = async (request: Request, response: Response) => {
    const adminEmail = this.getAdminEmailFromSession(request);
    const keyPrefix = typeof request.body?.keyPrefix === "string" ? request.body.keyPrefix : "";
    if (!adminEmail) {
      response.status(401).json({ error: "Admin session is required" });
      return;
    }
    try {
      response.json({ data: await this.apiKeyService.blockApiKey({ adminEmail, keyPrefix }) });
    } catch (error) {
      this.sendApiKeyError(response, error, "API key block is unavailable");
    }
  };

  adminVerifyApprovalDomain = async (request: Request, response: Response) => {
    const adminEmail = this.getAdminEmailFromSession(request);
    const keyPrefix = typeof request.body?.keyPrefix === "string" ? request.body.keyPrefix : "";
    const domain = typeof request.body?.domain === "string" ? request.body.domain : "";
    if (!adminEmail) {
      response.status(401).json({ error: "Admin session is required" });
      return;
    }
    try {
      const result = await this.apiKeyService.verifyApprovalDomain({ adminEmail, keyPrefix, domain });
      response.json({ data: result });
    } catch (error) {
      this.sendApiKeyError(response, error, "Domain verification is unavailable");
    }
  };

  adminReviewApprovalRequest = async (request: Request, response: Response) => {
    const adminEmail = this.getAdminEmailFromSession(request);
    const keyPrefix = typeof request.body?.keyPrefix === "string" ? request.body.keyPrefix : "";
    const action = request.body?.action === "reject" ? "reject" : "approve";
    const reason = typeof request.body?.reason === "string" ? request.body.reason : undefined;
    if (!adminEmail) {
      response.status(401).json({ error: "Admin session is required" });
      return;
    }
    try {
      response.json({ data: await this.apiKeyService.reviewApproval({ adminEmail, keyPrefix, action, reason }) });
    } catch (error) {
      this.sendApiKeyError(response, error, "Approval review is unavailable");
    }
  };

  private getAdminEmailFromSession(request: Request) {
    const authorization = request.header("authorization") || "";
    const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
    return verifyAdminToken(token);
  }

  revokeApiKeys = async (request: Request, response: Response) => {
    const email = typeof request.body?.email === "string" ? request.body.email : "";
    const firebaseIdToken = typeof request.body?.firebaseIdToken === "string" ? request.body.firebaseIdToken : "";
    const keyPrefix = typeof request.body?.keyPrefix === "string" ? request.body.keyPrefix : undefined;

    if (!email.trim() || !firebaseIdToken.trim()) {
      response.status(400).json({ error: "Email and Google sign-in are required" });
      return;
    }

    try {
      const verifiedUser = await verifyFirebaseIdToken(firebaseIdToken);
      if (verifiedUser.email !== email.trim().toLowerCase()) {
        response.status(403).json({ error: "Google account email does not match the submitted email" });
        return;
      }
      const result = await this.apiKeyService.revokeApiKeys({ email, keyPrefix, verifiedByGoogle: true });
      response.json({ data: result, message: "API key revoked." });
    } catch (error) {
      this.sendApiKeyError(response, error, "API key revoke is unavailable");
    }
  };

  private sendApiKeyError(response: Response, error: unknown, fallback: string) {
    const status = error instanceof ApiKeyServiceError ? error.status : error instanceof FirebaseAuthError ? 401 : 503;
    response.status(status).json({
      error: error instanceof Error ? error.message : fallback
    });
  }
}
