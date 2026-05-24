# Cricket Live

Automatic IPL match detection, live score scraping, MongoDB storage, public API keys, and a realtime React dashboard.

Frontend: https://cricket-live-frontend.vercel.app/

Backend API: https://cricket-live-0we0.onrender.com

## Overview

Cricket Live is a full-stack live IPL scoring system. The backend automatically tracks Cricbuzz IPL matches, switches to active matches, polls score updates, stores data in MongoDB, and broadcasts realtime updates through Socket.IO. The frontend shows a clean live score command dashboard with auto-refreshing scores, match lists, IPL table data, team logos, and series assets.

## Core Features

- Automatic IPL live, upcoming, and recent match detection
- Live score polling and active match switching
- Realtime Socket.IO score updates
- MongoDB Atlas persistence for matches, scores, commentary, API keys, and series data
- Redis support with memory-cache fallback
- Cricbuzz provider adapter for scraping IPL live scores and IPL series pages
- IPL 2026 points table, matches, squads, team logos, and local asset downloads
- Public developer API key generation
- Monthly API quota tracking for generated keys
- React + Vite frontend dashboard
- Production-ready backend deployment on Render, AWS EC2, or any Node host
- Frontend deployment on Vercel

## Architecture

```text
Cricbuzz
   |
   v
Match Scheduler
   |
   v
Live Match Detector -----> MongoDB Atlas
   |
   v
Score Updater
   |
   v
Redis / Memory Cache
   |
   v
Express REST API + Socket.IO
   |
   v
React Frontend / Developer API Users
```

## Tech Stack

Backend:

- Node.js
- Express
- TypeScript
- Socket.IO
- MongoDB + Mongoose
- Redis / in-memory fallback
- Axios + Cheerio

Frontend:

- React
- Vite
- TypeScript
- Socket.IO Client
- Lucide icons

Deployment:

- Frontend: Vercel
- Backend: Render or AWS EC2
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

Backend:

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/cricket_live?retryWrites=true&w=majority&appName=cricket-live
CORS_ORIGIN=https://cricket-live-frontend.vercel.app
REFRESH_SECRET=change_this_refresh_secret
PUBLIC_RATE_LIMIT_WINDOW_MS=60000
PUBLIC_RATE_LIMIT_MAX=120
DEVELOPER_RATE_LIMIT_WINDOW_MS=60000
DEVELOPER_RATE_LIMIT_MAX=10
TRACK_MATCH_RATE_LIMIT_WINDOW_MS=60000
TRACK_MATCH_RATE_LIMIT_MAX=20
CRICKET_PROVIDER=cricbuzz
CRICBUZZ_LIVE_URL=https://www.cricbuzz.com/cricket-match/live-scores
CRICBUZZ_BASE_URL=https://www.cricbuzz.com
CRICBUZZ_REQUEST_TIMEOUT_MS=15000
CRICBUZZ_REQUEST_RETRIES=2
MATCH_SCHEDULER_INTERVAL_MS=60000
SCORE_UPDATER_INTERVAL_MS=5000
SERIES_SCRAPER_INTERVAL_MS=600000
COMMENTARY_LIMIT=30
API_REQUIRE_KEY=false
API_FREE_MONTHLY_QUOTA=10000
API_MAX_ACTIVE_KEYS_PER_EMAIL=1
API_KEY_OTP_TTL_MINUTES=10
API_KEY_OTP_RESEND_SECONDS=60
API_KEY_OTP_MAX_ATTEMPTS=5
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=apikey@example.com
SMTP_PASS=your_smtp_password
SMTP_FROM="Cricket Live <apikey@example.com>"
```

Optional backend variables:

```env
REDIS_URL=redis://localhost:6379
```

Frontend:

```env
VITE_API_URL=https://cricket-live-0we0.onrender.com
VITE_SOCKET_URL=https://cricket-live-0we0.onrender.com
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

## Public Dashboard API

```text
GET /health
GET /api/matches
GET /api/live-match
GET /api/score/:matchId
GET /api/score-history/:matchId?limit=60
GET /api/commentary/:matchId
GET /api/series/ipl-2026
GET /api/system-status
```

Example:

```bash
curl https://cricket-live-0we0.onrender.com/api/live-match
```

## Developer API Keys

Users can sign in with Google at `/api/developer/api-keys`, generate an API key, and use the IPL feed in their own projects. The full key is shown only once, so store it safely.

The developer portal uses Firebase Google sign-in for key generation and revoke actions. No OTP or website-domain input is required.

Use the key:

```bash
curl https://cricket-live-0we0.onrender.com/api/v1/live-match \
  -H "x-api-key: cricket_live_your_key_here"
```

Protected developer endpoints:

```text
GET /api/v1/matches
GET /api/v1/live-match
GET /api/v1/score/:matchId
GET /api/v1/score-history/:matchId?limit=60
GET /api/v1/commentary/:matchId
GET /api/v1/series/ipl-2026
```

Each generated key starts on the open-source plan:

```text
Plan: open-source
Monthly quota: 10,000 requests per email
Active key limit: 1 key per email
Auth header: x-api-key
```

Quota headers are included on protected responses:

```text
x-api-plan
x-api-quota-limit
x-api-quota-used
x-api-quota-remaining
x-api-key-usage-used
```

## Website Widget

Developers can embed the live IPL score widget on any website.

```html
<div id="cricket-live-widget">Loading live cricket scores...</div>
<script
  async
  src="https://cricket-live-0we0.onrender.com/api/developer/widget.js"
  data-api-key="cricket_live_your_key_here"
  data-target="cricket-live-widget"
  data-refresh="30000"
></script>
```

The widget:

- Fetches the active IPL match automatically
- Updates on the configured interval, with a 30-second minimum
- Shows team logos, scores, and result/status text
- Uses the same monthly quota as the developer API key
- Uses Shadow DOM isolation and lazy-loads when visible

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
1. Scheduler fetches Cricbuzz live score page.
2. IPL matches are classified as live, upcoming, or completed.
3. Active live IPL match is selected automatically.
4. Score updater polls the active match every few seconds.
5. Score is saved to cache and MongoDB.
6. Socket.IO broadcasts updates to connected clients.
7. React dashboard updates without manual refresh.
8. Developer API users access protected /api/v1 endpoints with an API key.
```

## MongoDB Atlas Setup

Create a MongoDB Atlas cluster and database user, then add the URI to `MONGODB_URI`.

For local testing, add your current IP to Atlas Network Access.

For Render free hosting, outbound IPs are not fixed. For testing, you can allow:

```text
0.0.0.0/0
```

For production, prefer a static outbound IP, private networking, or a more restricted network rule.

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

Add environment variables from the backend env section.

Use this if Render skips dev dependencies during build:

```env
NPM_CONFIG_PRODUCTION=false
NODE_VERSION=20
```

## Vercel Frontend Deployment

Create a Vercel project from the same repository.

Recommended settings:

```text
Framework Preset: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

Add frontend environment variables:

```env
VITE_API_URL=https://your-backend-url
VITE_SOCKET_URL=https://your-backend-url
```

Redeploy the Vercel project after changing environment variables.

## Notes

- Render free services may sleep after inactivity, so first request can be slow.
- Cricbuzz page markup can change, which may require scraper updates.
- For a serious production product, use a licensed cricket data API.
- Do not commit `.env` files or database passwords.
- Rotate any exposed database password before production use.
- The open-source API key system is free-tier only. Billing plans can be added later with Stripe or Razorpay.

## License

MIT License.
