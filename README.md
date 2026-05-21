# Live Cricket Scraper + Realtime Score System

Production-style Node.js backend plus React dashboard for live cricket match detection, score polling, Redis caching, MongoDB persistence, Socket.IO updates, and AWS-ready deployment.

## What is included

- Auto match detection from Cricbuzz live scores page
- Active match switching when the current match completes
- Score polling every 5 seconds
- Redis cache with an in-memory fallback for local development
- MongoDB models for matches, scores, and commentary
- Socket.IO events: `matches_update`, `match_changed`, `score_update`, `commentary_update`
- REST API for live match, matches, score, and commentary
- React + Vite frontend dashboard with realtime updates
- Docker Compose for app, Redis, and MongoDB
- AWS deployment notes

## Run locally

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173

Backend: http://localhost:4000

Health check: http://localhost:4000/health

MongoDB storage is enabled when `MONGODB_URI` points to a running MongoDB instance. The default local value is:

```bash
mongodb://localhost:27017/cricket_live
```

If MongoDB is not running, the backend keeps serving live data from Redis or memory cache and retries MongoDB in the background.

## API

- `GET /api/matches`
- `GET /api/live-match`
- `GET /api/score/:matchId`
- `GET /api/score-history/:matchId?limit=60`
- `GET /api/commentary/:matchId`

## Socket events

Client emits:

- `join_match` with a match id
- `leave_match` with a match id

Server emits:

- `matches_update`
- `match_changed`
- `score_update`
- `commentary_update`
- `system_notice`

## AWS deployment

Recommended simple AWS path:

1. Build and push a Docker image to ECR.
2. Run the backend on ECS Fargate or Elastic Beanstalk Docker.
3. Use ElastiCache Redis for `REDIS_URL`.
4. Use MongoDB Atlas, DocumentDB, or self-hosted MongoDB for `MONGODB_URI`.
5. Put CloudFront + S3 in front of `frontend/dist`.
6. Configure `VITE_API_URL` and `VITE_SOCKET_URL` to the public backend URL.

## Important note about Cricbuzz

This project uses a pluggable provider adapter. Scraping public pages can break when markup changes and may be restricted by site terms. For production, prefer a licensed provider or an API plan. Keep `CRICKET_PROVIDER=mock` during local UI work when you do not need live data.
