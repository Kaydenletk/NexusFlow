# NexusFlow

Student Life Intelligence Dashboard built as a monorepo MVP. The current foundation tracks coding, listening, and health data, and Phase 1 adds WakaTime-powered coding rhythm, goals, and sync management.

## Stack

- Fastify 5 + TypeScript + Zod
- Next.js 16 + Tailwind + Tremor
- PostgreSQL 17 + TimescaleDB 2.25
- Drizzle ORM
- Docker Compose
- WakaTime summaries sync for coding activity

## Workspace layout

- `apps/api`: ingestion and analytics API
- `apps/web`: dashboard UI
- `packages/contracts`: shared schemas and response types
- `packages/db`: schema, migrations, and data helpers

## Getting started

1. Enable Corepack and install dependencies:
   - `corepack enable`
   - `corepack prepare pnpm@10.6.1 --activate`
   - `pnpm install`
2. Copy `.env.example` to `.env` if you want local overrides.
3. Start Docker Desktop before using Compose.
4. Run `docker compose up --build`.

The stack exposes:

- Dashboard: `http://localhost:3000`
- API: `http://localhost:3001`
- PostgreSQL/TimescaleDB: `localhost:5432`

## Local development

- `pnpm dev:api`
- `pnpm dev:web`
- `pnpm db:migrate`

## Import endpoints

- `POST /api/imports/coding-activity/manual`
- `POST /api/imports/coding-activity/csv`
- `POST /api/imports/listening-history/manual`
- `POST /api/imports/listening-history/csv`
- `POST /api/imports/health-metrics/manual`
- `POST /api/imports/health-metrics/csv`

## Phase 1 endpoints

- `GET /api/summary?range=7d|30d|90d`
- `GET /api/coding-activity?range=7d|30d|90d&bucket=day|week`
- `GET /api/listening-history?range=7d|30d|90d&bucket=day|week`
- `GET /api/health-metrics?metricType=steps&range=7d|30d|90d&bucket=day|week`
- `GET /api/recent?dataset=coding_activity&limit=10`
- `GET /api/imports?limit=20`
- `GET /api/integrations`
- `PUT /api/integrations/wakatime`
- `DELETE /api/integrations/wakatime`
- `POST /api/integrations/wakatime/sync`
- `GET /api/sync-runs?limit=20`
- `GET /api/goals`
- `POST /api/goals`
- `PUT /api/goals/:id`
- `DELETE /api/goals/:id`
- `GET /api/goals/progress`
- `GET /api/visualizations/heatmap?range=365d`
- `GET /api/visualizations/streaks`
- `GET /health`

## Phase 1 pages

- `/`
- `/coding`
- `/listening`
- `/health`
- `/imports`
- `/integrations`
- `/goals`

## WakaTime setup

1. Open `/integrations`.
2. Paste a WakaTime API key.
3. Enable the integration and save.
4. Trigger `Sync now` or wait for the 4-hour scheduler.

If the API key is invalid, the failed run is still recorded in both `sync_runs` and `import_batches` for debugging.

## Sample data

CSV files for quick import demos are included in [`sample-data/coding-activity.csv`](/Users/khanhle/Desktop/NexusFlow/sample-data/coding-activity.csv), [`sample-data/listening-history.csv`](/Users/khanhle/Desktop/NexusFlow/sample-data/listening-history.csv), and [`sample-data/health-metrics.csv`](/Users/khanhle/Desktop/NexusFlow/sample-data/health-metrics.csv).

## Tests

- `pnpm test`
