import type { Request, Response } from "express";
import { ApiKeyServiceError, type ApiKeyService } from "../services/apiKeyService.js";
import { FirebaseAuthError, verifyFirebaseIdToken } from "../services/firebaseAuthService.js";

export class DeveloperController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

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
      .sidebar { background: rgba(15, 17, 21, .94); border-right: 1px solid #24272e; padding: 22px 16px; display: flex; flex-direction: column; gap: 24px; position: sticky; top: 0; height: 100vh; }
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
      .crumbs { color: #9da6b3; font-size: 14px; font-weight: 430; }
      .auth-actions { align-items: center; display: flex; gap: 10px; }
      .user-card { align-items: center; display: flex; gap: 10px; }
      .avatar { border-radius: 99px; border: 1px solid #3a404b; height: 34px; object-fit: cover; width: 34px; }
      .avatar.placeholder { align-items: center; background: #252b35; display: flex; font-weight: 560; justify-content: center; }
      .content { margin: 28px auto 0; max-width: 1260px; }
      .hero { display: grid; grid-template-columns: minmax(0, .92fr) minmax(380px, .78fr); gap: 22px; align-items: start; }
      .intro, .card { background: rgba(31, 33, 38, .92); border: 1px solid #30343b; border-radius: 14px; box-shadow: 0 20px 50px rgba(0, 0, 0, .18); }
      .intro { min-height: 300px; padding: 28px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative; }
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
      .docs-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); }
      .endpoint { background: #171a20; border: 1px solid #30343b; border-radius: 12px; padding: 14px; }
      .endpoint code { display: inline-block; margin-bottom: 9px; }
      .endpoint p { font-size: 13px; }
      .preview-box { background: #0f1217; border: 1px dashed #3c4654; border-radius: 12px; display: grid; gap: 10px; margin-top: 14px; padding: 14px; }
      .meter { background: #111419; border: 1px solid #30343b; border-radius: 999px; height: 10px; overflow: hidden; }
      .meter > div { background: #16a367; height: 100%; width: 0%; }
      .keys-table { border: 1px solid #30343b; border-radius: 10px; overflow: hidden; }
      .key-row { align-items: center; display: grid; gap: 12px; grid-template-columns: 1.25fr .9fr .75fr .8fr auto; padding: 13px 14px; }
      .key-row + .key-row { border-top: 1px solid #30343b; }
      .key-head { background: #171a20; color: #8f98a3; font-size: 12px; text-transform: uppercase; }
      .key-prefix { color: #dce3eb; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
      .pill { border: 1px solid #3a404b; border-radius: 999px; color: #c9d2df; display: inline-flex; font-size: 12px; padding: 5px 9px; width: fit-content; }
      .pill.active { border-color: rgba(93, 228, 155, .35); color: #bdf8d8; }
      .pill.revoked { border-color: rgba(239, 68, 68, .35); color: #ffc7c7; }
      .muted { color: #8f98a3; font-size: 14px; margin-top: 6px; }
      .fine { color: #7f8896; font-size: 12px; }
      [hidden] { display: none !important; }
      @media (max-width: 980px) { .shell { grid-template-columns: 1fr; } .sidebar { display: none; } .workspace { padding: 14px; } .topbar { top: 10px; } .mobile-nav { display: flex; } .hero { grid-template-columns: 1fr; } .intro { min-height: auto; } }
      @media (max-width: 840px) { .usage-grid, .docs-grid { grid-template-columns: repeat(2, 1fr); } .key-row { grid-template-columns: 1fr; } .key-head { display: none; } }
      @media (max-width: 640px) { .grid2, .stats, .usage-grid, .docs-grid { grid-template-columns: 1fr; } .workspace { padding: 10px; } .content { margin-top: 16px; } .intro, .card { padding: 18px; } .topbar, .auth-row { align-items: stretch; flex-direction: column; } .auth-actions { width: 100%; } .auth-actions button { flex: 1; } .mobile-nav { margin-top: 10px; } h1 { font-size: 32px; } }
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
          <a class="nav-item active" data-nav="dashboard" href="#dashboard"><span class="nav-dot"></span> Dashboard</a>
          <a class="nav-item" data-nav="usage" href="#usage"><span class="nav-dot"></span> Usage</a>
          <a class="nav-item" data-nav="embed" href="#embed"><span class="nav-dot"></span> Embed widget</a>
          <a class="nav-item" data-nav="docs" href="#docs"><span class="nav-dot"></span> API docs</a>
          <a class="nav-item" data-nav="revoke" href="#revoke"><span class="nav-dot"></span> Revoke key</a>
        </nav>
        <div class="side-card">
          <p class="fine">Free mode active</p>
          <h2 style="margin-top: 4px;">Live scores API</h2>
          <p class="muted">Google sign-in and simple copy-paste widget keys.</p>
        </div>
      </aside>

      <section class="workspace">
        <header class="topbar">
          <div>
            <div class="crumbs">Dashboard / API keys</div>
          </div>
          <div class="auth-actions">
            <div id="authSkeleton" class="skeleton skeleton-button"></div>
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
          <a class="nav-item active" data-nav="dashboard" href="#dashboard">Dashboard</a>
          <a class="nav-item" data-nav="usage" href="#usage">Usage</a>
          <a class="nav-item" data-nav="embed" href="#embed">Embed</a>
          <a class="nav-item" data-nav="docs" href="#docs">Docs</a>
          <a class="nav-item" data-nav="revoke" href="#revoke">Revoke</a>
        </nav>

        <div class="content">
          <section id="dashboard" class="hero">
            <div class="intro">
              <div>
                <p class="eyebrow">Cricket Live Command</p>
                <h1>API keys</h1>
                <p>Create and manage keys for the live score widget. Use the <code>x-api-key</code> header for direct API calls.</p>
              </div>
              <div class="stats">
                <div class="stat"><strong>Google</strong><span>Sign-in gate</span></div>
                <div class="stat"><strong>Email</strong><span>Google verified</span></div>
                <div class="stat"><strong>Easy</strong><span>Copy paste</span></div>
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

      <section id="embed" class="panel">
        <div class="card">
          <div class="card-head">
            <div>
              <h2>Embed widget</h2>
              <p class="muted">Paste this snippet in any website. Replace YOUR_API_KEY with your active key.</p>
            </div>
            <span class="badge">Copy paste</span>
          </div>
          <textarea id="embedTemplate" readonly></textarea>
          <p class="status">Generate an API key first, then replace the placeholder key in this snippet.</p>
          <div class="preview-box">
            <div class="fine">Preview container</div>
            <div id="widgetPreview">Loading live cricket scores...</div>
          </div>
        </div>
      </section>

      <section id="usage" class="panel">
        <div class="card">
          <div class="card-head">
            <div>
              <h2>Usage</h2>
              <p class="muted">Live API usage for your Google account.</p>
            </div>
            <span id="usageUpdatedAt" class="badge">Waiting</span>
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
          <div id="keysTable" class="keys-table" style="margin-top:16px;">
            <div class="key-row key-head"><div>Key</div><div>Usage</div><div>Status</div><div>Last used</div><div>Action</div></div>
            <div class="key-row"><div class="muted">Sign in to load usage.</div></div>
          </div>
        </div>
      </section>

      <section id="docs" class="panel">
        <div class="card">
          <div class="card-head">
            <div>
              <h2>API docs</h2>
              <p class="muted">Use <code>x-api-key</code> for direct API calls. Widget embed uses the same key.</p>
            </div>
            <span class="badge">v1</span>
          </div>
          <div class="docs-grid">
            <div class="endpoint">
              <code>GET /api/v1/matches</code>
              <p>Live, upcoming, and recent IPL matches.</p>
            </div>
            <div class="endpoint">
              <code>GET /api/v1/live-match</code>
              <p>Current live match with score summary.</p>
            </div>
            <div class="endpoint">
              <code>GET /api/v1/score/:matchId</code>
              <p>Detailed score for one match.</p>
            </div>
            <div class="endpoint">
              <code>GET /api/system-status</code>
              <p>Backend uptime and scraper health status.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="revoke" class="panel">
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
      const form = document.getElementById("keyForm");
      const revokeForm = document.getElementById("revokeForm");
      const result = document.getElementById("result");
      const apiKeyBox = document.getElementById("apiKey");
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
      const gatedControls = Array.from(document.querySelectorAll("#keyForm input, #keyForm button, #revokeForm input, #revokeForm button"));
      const createEmailInput = form.elements.email;
      const revokeEmailInput = revokeForm.elements.email;
      let currentKey = "";
      let currentUser = null;
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
        const used = Number(data.emailUsageCount || 0);
        const quota = Number(data.monthlyQuota || 0);
        const remaining = Math.max(Number(data.remaining || 0), 0);
        usageUsed.textContent = formatNumber(used);
        usageRemaining.textContent = formatNumber(remaining);
        usageQuota.textContent = formatNumber(quota);
        usageRateLimit.textContent = formatNumber(data.rateLimit?.limit) + "/min";
        usageMeter.style.width = quota > 0 ? Math.min((used / quota) * 100, 100).toFixed(1) + "%" : "0%";
        usageUpdatedAt.textContent = "Updated " + new Date().toLocaleTimeString();
        const rows = Array.isArray(data.keys) ? data.keys : [];
        keysTable.innerHTML = '<div class="key-row key-head"><div>Key</div><div>Usage</div><div>Status</div><div>Last used</div><div>Action</div></div>' +
          (rows.length ? rows.map((key) => {
            const statusClass = key.revoked ? "revoked" : "active";
            const statusText = key.revoked ? "Revoked" : "Active";
            const action = key.revoked ? '<span class="fine">--</span>' : '<button class="danger tiny" type="button" data-delete-key="' + escapeHtml(key.keyPrefix) + '">Delete</button>';
            return '<div class="key-row">' +
              '<div><div class="key-prefix">' + escapeHtml(key.keyPrefix) + '</div><div class="fine">' + escapeHtml(key.name) + '</div></div>' +
              '<div>' + formatNumber(key.usageCount) + ' / ' + formatNumber(key.monthlyQuota) + '</div>' +
              '<div><span class="pill ' + statusClass + '">' + statusText + '</span></div>' +
              '<div class="fine">' + escapeHtml(formatDate(key.lastUsedAt)) + '</div>' +
              '<div>' + action + '</div>' +
            '</div>';
          }).join("") : '<div class="key-row"><div class="muted">No API keys yet.</div></div>');
      }

      function resetUsage() {
        usageUsed.textContent = "--";
        usageRemaining.textContent = "--";
        usageQuota.textContent = "--";
        usageRateLimit.textContent = "--";
        usageMeter.style.width = "0%";
        usageUpdatedAt.textContent = "Waiting";
        keysTable.innerHTML = '<div class="key-row key-head"><div>Key</div><div>Usage</div><div>Status</div><div>Last used</div><div>Action</div></div><div class="key-row"><div class="muted">Sign in to load usage.</div></div>';
      }

      function syncSignedInUser(user) {
        document.body.classList.remove("auth-loading");
        document.body.classList.add("auth-ready");
        currentUser = user || null;
        const signedIn = Boolean(user);
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
        const id = (location.hash || "#dashboard").replace("#", "");
        return ["dashboard", "usage", "embed", "docs", "revoke"].includes(id) ? id : "dashboard";
      }

      function setActiveNav(id) {
        document.querySelectorAll("[data-nav]").forEach((link) => {
          link.classList.toggle("active", link.getAttribute("data-nav") === id);
        });
      }

      function scrollToCurrentSection() {
        const id = currentSectionFromHash();
        setActiveNav(id);
        const section = document.getElementById(id);
        if (section) section.scrollIntoView({ block: "start", behavior: "smooth" });
      }

      document.querySelectorAll("[data-nav]").forEach((link) => {
        link.addEventListener("click", () => {
          window.setTimeout(scrollToCurrentSection, 0);
        });
      });
      window.addEventListener("hashchange", scrollToCurrentSection);
      setActiveNav(currentSectionFromHash());

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
            firebaseIdToken
          });

          currentKey = payload.data.key;
          apiKeyBox.value = currentKey;
          exampleBox.value = '<div id="cricket-live-widget">Loading live cricket scores...</div>\\n<script async src="' + location.origin + '/api/developer/widget.js" data-api-key="' + currentKey + '" data-target="cricket-live-widget" data-refresh="30000"><\\/script>';
          quotaStatus.className = "status ok";
          quotaStatus.textContent = "Copy it now. Limit: " + payload.data.monthlyQuota + " requests/month for this email.";
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

  createApiKey = async (request: Request, response: Response) => {
    const name = typeof request.body?.name === "string" ? request.body.name : "";
    const email = typeof request.body?.email === "string" ? request.body.email : "";
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
      result = await this.apiKeyService.createApiKey({ name, email, verifiedByGoogle: true });
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
