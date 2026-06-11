# Telemt MTProxy Panel

## Project Overview

A web-based admin panel for the **Telemt** Telegram MTProto Proxy server (Rust). The panel provides a full management UI for users and proxy configuration.

### Architecture

- **Backend**: `telemt` — Rust MTProxy server, exposes HTTP management API on `localhost:9091`
- **Frontend**: React + Vite + Tailwind CSS admin panel on port `5000`
- **Proxy**: Vite dev server proxies `/api/*` → `http://127.0.0.1:9091`

### Panel Pages

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/dashboard` | Health status, stat cards, upstreams, error breakdown, system info |
| Users | `/users` | Full user table with create/edit/delete/enable/disable/rotate-secret/reset-quota |
| Stats | `/stats` | Detailed metrics: core, upstream, middle proxy, pool, user quota |
| Security | `/security` | Security posture, API whitelists, effective limits |

### Key Directories

- `panel/` — React + Vite frontend
- `panel/src/pages/` — Page components (Dashboard, Users, Stats, Security)
- `panel/src/components/` — Shared UI (Layout, Sidebar, Modal, Toast, StatCard)
- `panel/src/api.js` — API client wrapping all telemt REST endpoints
- `src/` — Telemt Rust source code
- `config.toml` — Telemt server config (proxy on port 8443, API on 9091)

### Running

1. **Panel**: Starts automatically via workflow (`cd panel && pnpm run dev`)
2. **Telemt server**: Build with `cargo build --release`, then run `./target/release/telemt config.toml`
   - After building, the panel will automatically connect to the API on port 9091

### API Endpoints (proxied via `/api`)

All telemt API calls go through `/api` → `localhost:9091`:
- `GET /api/v1/health` — Health check
- `GET /api/v1/stats/users` — User list with runtime stats
- `POST /api/v1/users` — Create user
- `PATCH /api/v1/users/{user}` — Update user
- `DELETE /api/v1/users/{user}` — Delete user
- `POST /api/v1/users/{user}/rotate-secret` — Rotate secret
- etc.

## User Preferences

- Language: Russian (UI labels are in Russian)
- Dark theme
