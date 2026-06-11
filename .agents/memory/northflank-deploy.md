---
name: Northflank deployment setup
description: How panel and bot are containerized and deployed to Northflank via GitHub with PostgreSQL.
---

## What was done

Migrated all JSON file storage to PostgreSQL and added full Docker/Northflank deploy configuration.

## Key decisions

- Schema is inlined in `panel/server/db.js` (INIT_SQL const) — avoids cross-directory file copy issues in Docker build context.
- Panel Dockerfile build context is `panel/` only; no access to root `db/init.sql` at build time (schema runs at runtime via `initDb()`).
- `DATABASE_SSL=false` for local dev; `DATABASE_SSL=true` for Northflank (pg addon uses TLS).
- Bot loads token via Panel API (`GET /bot/settings`) instead of reading from JSON file — works in containerized setup.
- Panel listens on `process.env.PORT` (default 9092 dev, 3000 prod).
- Bot connects to panel via `PANEL_API` env var (default `http://127.0.0.1:9092`).

## Files created/modified

- `panel/server/db.js` — pg Pool, initDb(), query()
- `panel/server/bot-db.js` — all functions rewritten with pg queries
- `panel/server/index.js` — nodes/users use pg; serves built React from `dist/`; `main()` calls `initDb()`
- `panel/package.json` — added `pg`, `serve-static`
- `panel/Dockerfile` — multi-stage: pnpm build → production image
- `bot/Dockerfile` — simple Node.js image
- `bot/bot.js` — `loadToken()` and `getSettings()` now call Panel API
- `docker-compose.yml` — rewritten: db + panel + bot services
- `northflank.json` — project spec with 2 services + postgres addon
- `.github/workflows/deploy.yml` — builds and pushes to GHCR on push to main
- `db/init.sql` — standalone SQL schema (for reference / manual runs)
- `DEPLOY.md` — step-by-step Northflank setup guide (Russian)
- `.env.example` — local dev env vars template

**Why:**  Containers need immutable images; file-based storage doesn't survive restarts or scaling. PostgreSQL is the correct persistent store for production.
