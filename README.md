# Cricket Live

Automatic cricket match detection, live score scraping, MongoDB storage, and a realtime React dashboard.

Frontend: https://cricket-live-frontend.vercel.app/

Backend API: https://cricket-live-0we0.onrender.com

## Overview

Cricket Live is a full-stack live cricket scoring system built for IPL, T20, ODI, Test, and other cricket matches. The backend automatically tracks Cricbuzz live matches, switches to active matches, polls score updates, stores data in MongoDB, and broadcasts realtime updates through Socket.IO. The frontend shows a clean live score command dashboard with auto-refreshing scores, match lists, IPL table data, team logos, and series assets.

## Core Features

- Automatic live, upcoming, and recent match detection
- Live score polling and active match switching
- Realtime Socket.IO score updates
- MongoDB Atlas persistence for matches, scores, commentary, and series data
- Redis support with memory-cache fallback
- Cricbuzz provider adapter for scraping live scores and IPL series pages
- IPL 2026 points table, matches, squads, team logos, and local asset downloads
- React + Vite frontend dashboard
- Responsive scorecard layout with team logos
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
React Frontend / Future Mobile App
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
├── backend
│   ├── src
│   │   ├── config
│   │   ├── controllers
│   │   ├── cron
│   │   ├── middleware
│   │   ├── models
│   │   ├── providers
│   │   ├── routes
│   │   ├── services
│   │   ├── sockets
│   │   ├── utils
│   │   ├── app.ts
│   │   └── server.ts
│   └── public
│       └── assets
├── frontend
│   └── src
├── docker-compose.yml
├── package.json
└── README.md
```

## Environment Variables

Backend:

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/cricket_live?retryWrites=true&w=majority&appName=cricket-live
CORS_ORIGIN=https://cricket-live-frontend.vercel.app
CRICKET_PROVIDER=cricbuzz
CRICBUZZ_LIVE_URL=https://www.cricbuzz.com/cricket-match/live-scores
CRICBUZZ_BASE_URL=https://www.cricbuzz.com
MATCH_SCHEDULER_INTERVAL_MS=60000
SCORE_UPDATER_INTERVAL_MS=5000
SERIES_SCRAPER_INTERVAL_MS=600000
COMMENTARY_LIMIT=30
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

Run backend only:

```bash
npm run dev --workspace backend
```

Run frontend only:

```bash
npm run dev --workspace frontend
```

## API Endpoints

```text
GET /health
GET /api/matches
GET /api/live-match
GET /api/score/:matchId
GET /api/score-history/:matchId?limit=60
GET /api/commentary/:matchId
GET /api/series/ipl-2026
```

Example:

```bash
curl https://cricket-live-0we0.onrender.com/api/live-match
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
1. Scheduler fetches Cricbuzz live score page.
2. Matches are classified as live, upcoming, or completed.
3. Active live match is selected automatically.
4. Score updater polls the active match every few seconds.
5. Score is saved to cache and MongoDB.
6. Socket.IO broadcasts updates to connected clients.
7. React dashboard updates without manual refresh.
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

## AWS EC2 Backend Deployment

The backend can also run on Ubuntu EC2 using PM2 and Nginx.

High-level steps:

```text
1. Launch Ubuntu EC2.
2. Install Node.js 20, Git, Nginx, and PM2.
3. Clone this repository.
4. Create backend .env.
5. Run npm ci.
6. Build backend.
7. Start backend with PM2.
8. Proxy port 80/443 to backend port 4000 with Nginx.
9. Add the EC2 public IP to MongoDB Atlas Network Access.
```

Example PM2 command:

```bash
pm2 start backend/dist/server.js --name cricket-live-backend --update-env
pm2 save
```

## Notes

- Render free services may sleep after inactivity, so first request can be slow.
- Cricbuzz page markup can change, which may require scraper updates.
- For a serious production product, use a licensed cricket data API.
- Do not commit `.env` files or database passwords.
- Rotate any exposed database password before production use.

## License

Private project.
