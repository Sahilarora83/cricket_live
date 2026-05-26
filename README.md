# Cricket Live

Private live cricket score platform with automatic match tracking, realtime score updates, API-key access, and a React dashboard.

> This repository is public, but production URLs, API keys, database URIs, SMTP credentials, and Firebase private values must stay private. Do not publish live backend or frontend links in this README.

## Overview

Cricket Live is a full-stack cricket score system. The backend tracks live, upcoming, and recent matches, polls score updates, stores data in MongoDB, and pushes realtime updates with Socket.IO. The frontend provides a live dashboard for monitoring matches and scores.

## Features

- Automatic live, upcoming, and recent match detection
- Active match switching and score polling
- Realtime Socket.IO updates
- MongoDB persistence for matches, scores, commentary, API keys, and series data
- Redis support with in-memory fallback
- API-key protected developer endpoints
- Monthly quota and per-key rate limiting
- React + Vite dashboard
- Optional Render keep-alive ping for free-tier deployments

## Access Policy

Production access should be shared privately only.

- Keep production backend and frontend URLs out of public documentation.
- Keep `.env` files out of Git.
- Use API keys for external consumers.
- Keep `REFRESH_SECRET`, `MONGODB_URI`, `SMTP_PASS`, and Firebase private values secret.
- Rotate credentials immediately if they are exposed publicly.
- Prefer private docs, a dashboard notice, or direct messages for sharing live URLs.

## Tech Stack

Backend:

- Node.js
- Express
- TypeScript
- Socket.IO
- MongoDB + Mongoose
- Redis or in-memory cache
- Axios + Cheerio

Frontend:

- React
- Vite
- TypeScript
- Socket.IO Client
- Lucide icons

Deployment:

- Backend: Render, AWS EC2, or any Node host
- Frontend: Vercel or any static host
- Database: MongoDB Atlas

## Project Structure

```text
.
|-- backend
|   |-- src
|   |   |-- config
|   |   |-- controllers
|   |   |-- cron
|   |   |-- middleware
|   |   |-- models
|   |   |-- routes
|   |   |-- services
|   |   |-- sockets
|   |   |-- utils
|   |   |-- app.ts
|   |   `-- server.ts
|   `-- public
|       `-- assets
|-- frontend
|   `-- src
|-- docker-compose.yml
|-- package.json
|-- LICENSE
`-- README.md
```

## Environment Variables

Copy `.env.example` to `.env` for local development. In production, add variables in the hosting dashboard instead of committing them.

Backend:

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/cricket_live
CORS_ORIGIN=https://your-frontend-domain.example
REFRESH_SECRET=use_a_long_random_secret

CRICKET_PROVIDER=cricbuzz
CRICBUZZ_LIVE_URL=https://www.cricbuzz.com/cricket-match/live-scores
CRICBUZZ_BASE_URL=https://www.cricbuzz.com
CRICBUZZ_REQUEST_TIMEOUT_MS=15000
CRICBUZZ_REQUEST_RETRIES=2

PUBLIC_RATE_LIMIT_WINDOW_MS=60000
PUBLIC_RATE_LIMIT_MAX=120
DEVELOPER_RATE_LIMIT_WINDOW_MS=60000
DEVELOPER_RATE_LIMIT_MAX=10
TRACK_MATCH_RATE_LIMIT_WINDOW_MS=60000
TRACK_MATCH_RATE_LIMIT_MAX=20

MATCH_SCHEDULER_INTERVAL_MS=60000
SCORE_UPDATER_INTERVAL_MS=5000
SERIES_SCRAPER_INTERVAL_MS=600000
COMMENTARY_LIMIT=30

API_REQUIRE_KEY=true
API_KEY_RATE_LIMIT_WINDOW_MS=60000
API_KEY_RATE_LIMIT_MAX=600
API_FREE_MONTHLY_QUOTA=10000
API_MAX_ACTIVE_KEYS_PER_EMAIL=1
API_KEY_DAILY_CREATE_LIMIT=3
API_KEY_CREATE_COOLDOWN_SECONDS=60
API_KEY_REVOKE_COOLDOWN_SECONDS=300
API_KEY_OTP_TTL_MINUTES=10
API_KEY_OTP_RESEND_SECONDS=60
API_KEY_OTP_MAX_ATTEMPTS=5
API_ADMIN_EMAILS=admin@example.com
API_ADMIN_CONSOLE_PATH=cricket-command-approval-center-7f4d2a9x
API_ADMIN_LOGIN_EMAIL=admin@example.com
API_ADMIN_PASSWORD_HASH=sha256:replace_with_sha256_password_hash
API_ADMIN_SESSION_SECRET=replace_with_long_random_session_secret

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=apikey@example.com
SMTP_PASS=your_smtp_password
SMTP_FROM="Cricket Live <apikey@example.com>"
```

Optional backend variables:

```env
REDIS_URL=redis://localhost:6379
KEEP_ALIVE_URL=https://your-backend-domain.example/health
KEEP_ALIVE_INTERVAL_MS=600000
KEEP_ALIVE_REQUEST_TIMEOUT_MS=10000
```

Frontend:

```env
VITE_API_URL=https://your-backend-domain.example
VITE_SOCKET_URL=https://your-backend-domain.example
```

## Local Development

Install dependencies:

```bash
npm install
```

Run backend and frontend together:

```bash
npm run dev
```

Local URLs:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:4000
Health:   http://localhost:4000/health
```

Build everything:

```bash
npm run build
```

## API Access

The app has two API areas:

- Dashboard routes under `/api/...` for the official frontend.
- Developer routes under `/api/v1/...` for API-key consumers.

Public README files should not include production curl commands or live service URLs. Share production API examples only in private documentation.

Developer requests must include:

```text
x-api-key: cricket_live_your_key_here
```

API keys use an approval workflow:

```text
1. Developer signs in with Google.
2. Developer generates a key and submits website domains.
3. Developer uploads /cricket-live-verify.txt to the website root.
4. Admin reviews the request from the Approvals console.
5. The key works only after admin approval.
```

Set `API_ADMIN_EMAILS` to a comma-separated list of Google accounts that can approve or reject domain requests.
Set `API_ADMIN_CONSOLE_PATH` to a private 12-80 character slug. The admin console will be available at `/api/developer/<slug>`.
Set `API_ADMIN_PASSWORD_HASH` to a SHA-256 password hash in `sha256:<hex>` format and keep `API_ADMIN_SESSION_SECRET` private.

API keys include:

```text
Monthly quota
Per-minute rate limit
Active key limit
Create/revoke cooldowns
Usage headers
```

## Website Widget

The embeddable widget is available from the backend developer route, but production script URLs should be shared privately with approved users only.

Example shape:

```html
<div id="cricket-live-widget">Loading live cricket scores...</div>
<script
  async
  src="https://your-backend-domain.example/api/developer/widget.js"
  data-api-key="cricket_live_your_key_here"
  data-target="cricket-live-widget"
  data-refresh="30000"
></script>
```

## Socket.IO Events

Client emits:

```text
join_match
leave_match
```

Server emits:

```text
matches_update
match_changed
score_update
commentary_update
system_notice
```

## Data Flow

```text
1. Scheduler fetches the source live-score page.
2. Matches are classified as live, upcoming, or completed.
3. Active live match is selected automatically.
4. Score updater polls the active match.
5. Score is saved to cache and MongoDB.
6. Socket.IO broadcasts updates to connected clients.
7. React dashboard updates without manual refresh.
8. Developer users access protected routes with an API key.
```

## Render Backend Deployment

Create a Render Web Service from this GitHub repository.

Recommended settings:

```text
Language: Node
Branch: main
Root Directory: backend
Build Command: npm install --include=dev && npm run build
Start Command: npm start
Instance Type: Free or higher
```

Add production environment variables in Render.

Useful Render variables:

```env
NPM_CONFIG_PRODUCTION=false
NODE_VERSION=20
KEEP_ALIVE_URL=https://your-backend-domain.example/health
```

Render free services can sleep after inactivity. The keep-alive option pings `/health` after the service is awake, but it cannot bypass free-tier usage limits.

## Vercel Frontend Deployment

Create a Vercel project from the same repository.

Recommended settings:

```text
Framework Preset: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

Add frontend environment variables in Vercel:

```env
VITE_API_URL=https://your-backend-domain.example
VITE_SOCKET_URL=https://your-backend-domain.example
```

Redeploy after changing environment variables.

## Security Checklist

- Do not commit `.env`, API keys, database passwords, SMTP passwords, or private Firebase keys.
- Do not publish production URLs in public README files, screenshots, issues, or comments.
- Use `API_REQUIRE_KEY=true` in production when exposing developer data routes.
- Keep public dashboard rate limits conservative.
- Restrict MongoDB Atlas network access as much as your host allows.
- Rotate any exposed credential before using the app in production.
- Use a licensed data provider for serious production usage.

## License

MIT License.
