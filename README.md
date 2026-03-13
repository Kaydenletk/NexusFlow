# NexusFlow

NexusFlow is a local-first focus intelligence system. The primary product has three surfaces:

- `packages/focus-core`: canonical schemas, heuristics, and analytics
- `apps/extension`: the browser sensor that records sessions and exports snapshots
- `apps/web`: the local-first dashboard that imports and analyzes those snapshots

The quantified-self API and database stack still live in the repo, but they are legacy/internal modules now. They are no longer the primary product story.

## Product direction

NexusFlow measures browser work rhythm rather than generic productivity totals. It focuses on:

- context-switch tax
- deep-work blocks
- daily fragmentation
- early burnout pressure
- category and host-level focus patterns

The system is privacy-first and local-first:

- the extension records browser sessions into local IndexedDB
- the extension exports a canonical `FocusSnapshotV1` JSON file
- the web app validates and analyzes that JSON locally
- focus flows do not require backend calls, auth, or cloud sync

## Primary workspaces

- `packages/focus-core`
  - single source of truth for `FocusSnapshotV1`
  - Zod schemas in [`packages/focus-core/src/schema.ts`](/Users/khanhle/Desktop/NexusFlow/packages/focus-core/src/schema.ts)
  - inferred types in [`packages/focus-core/src/types.ts`](/Users/khanhle/Desktop/NexusFlow/packages/focus-core/src/types.ts)
  - heuristics and derived analytics in [`packages/focus-core/src/analytics.ts`](/Users/khanhle/Desktop/NexusFlow/packages/focus-core/src/analytics.ts)
- `apps/extension`
  - Manifest V3 browser sensor
  - IndexedDB-backed session recorder
  - popup/export surface
- `apps/web`
  - Next.js local-first analysis dashboard
  - JSON import, local persistence, and focus visualization

## Legacy/internal modules

These remain in the repo but are not part of the default product path:

- `apps/api`
- `packages/db`
- `packages/contracts`

Use them only if you are explicitly working on the older quantified-self stack.

## Getting started

1. Enable Corepack and install dependencies:
   - `corepack enable`
   - `corepack prepare pnpm@10.6.1 --activate`
   - `pnpm install`
2. Start the focus-first dev workflow:
   - `pnpm dev`

Primary scripts:

- `pnpm dev`
- `pnpm dev:focus`
- `pnpm dev:web`
- `pnpm watch:extension`
- `pnpm test`
- `pnpm build`

Legacy/internal scripts:

- `pnpm legacy:dev`
- `pnpm legacy:dev:api`
- `pnpm legacy:db:migrate`
- `pnpm legacy:db:check`
- `pnpm legacy:db:seed`

## Browser sensor workflow

The extension build output lives in [`apps/extension/dist`](/Users/khanhle/Desktop/NexusFlow/apps/extension/dist).

1. Run `pnpm watch:extension` to keep the unpacked extension rebuilt.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select [`apps/extension/dist`](/Users/khanhle/Desktop/NexusFlow/apps/extension/dist).
6. Keep the extension pinned for quick export access.

The recommended loop is:

- `pnpm dev:web` for the dashboard
- `pnpm watch:extension` for the sensor
- reload the extension after rebuilds in `chrome://extensions`

## Focus snapshot contract

`FocusSnapshotV1` is the single source of truth for cross-surface exchange.

- schema: [`packages/focus-core/src/schema.ts`](/Users/khanhle/Desktop/NexusFlow/packages/focus-core/src/schema.ts)
- exports: [`packages/focus-core/src/index.ts`](/Users/khanhle/Desktop/NexusFlow/packages/focus-core/src/index.ts)

Rules:

- the extension exports only `FocusSnapshotV1`
- the web app imports only `FocusSnapshotV1`
- schema validation and analytics come from `@nexusflow/focus-core`
- focus features must not depend on legacy quantified-self contracts

## Focus dashboard

The primary UI is the focus dashboard:

- home: `http://localhost:3000/`
- focus surface: `http://localhost:3000/focus`

The focus surface is fully local-first. It imports snapshot JSON, stores it locally, and renders:

- burnout signal
- deep-work blocks
- category breakdown
- top hosts
- fragmentation and context switching views

## Chrome activity dashboard

NexusFlow also includes a localhost-backed Chrome activity surface:

- dashboard: `http://localhost:3000/chrome`
- API health: `http://localhost:3001/api/chrome/health`

This path is different from `/focus`:

- `/focus` is local-first snapshot analysis
- `/chrome` is backend-driven and shows what the API actually stored from Chrome sync

The Chrome dashboard includes:

- backend health and DB status
- tracked time and productive vs distracting ratio
- top hosts and categories
- context-switch metrics
- raw stored sessions
- Canvas course rhythm from backend data
- sync diagnostics for extension uploads

## Chrome sync workflow

To send live Chrome data into the localhost backend:

1. Start the full local stack:
   - `docker compose up --build -d`
2. Keep the extension rebuilt:
   - `pnpm watch:extension`
3. Load the unpacked extension from [`apps/extension/dist`](/Users/khanhle/Desktop/NexusFlow/apps/extension/dist)
4. Open the extension popup
5. Confirm:
   - `Localhost Chrome sync` is enabled
   - `API Base URL` is `http://localhost:3001`
6. Browse normally in Chrome
7. Open `http://localhost:3000/chrome` to inspect stored backend data

What the extension sends:

- tab and window identifiers
- origin, hostname, and privacy-filtered path
- document title when allowed
- category and intent from `@nexusflow/focus-core`
- session start, end, duration, and transition reason

Privacy defaults:

- full path is retained for learning and technical sites such as Canvas and GitHub
- sensitive hosts such as mail, auth, and document tools are masked before sync
- masked sessions still contribute to totals and host/category analytics

## Verification

Run:

- `pnpm test`
- `pnpm build`

Acceptance goals for this pivot:

- extension exports a valid `FocusSnapshotV1`
- web imports that JSON without backend calls
- focus analytics remain owned by `packages/focus-core`
- legacy quantified-self modules stay isolated from focus flows
