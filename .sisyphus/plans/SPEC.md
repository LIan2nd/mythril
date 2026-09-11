# MYTHRIL — Full-Stack Next.js Implementation Contract

Source of truth for all agents. The visual design is a **neo-brutalist sprint Kanban dashboard**. Fidelity reference: `.req/mythril-dashboard.html` + `.req/DESIGN-HANDOFF.md` (3px borders, hard offset shadows `5px 5px 0 #0A0A0A`, Arial Black display font, yellow/coral/mint/lavender/sky accents, light `#FFF6DE` / dark `#16130C` themes, `--radius:4px`, mono labels uppercase). Do NOT use framework-default styling (no shadcn/MUI look), no soft rounded cards, no gradients. **The exported CSS tokens and pixel behavior win over any convention.**

## Stack decision (locked — NO Flask, single app)

- **Next.js 15 App Router, TypeScript strict**, `output: "standalone"`. API = route handlers under `src/app/api/**`. Tailwind CSS 3, but components style via the design's CSS variables (token names copied verbatim from export).
- **DB**: PostgreSQL 16 via `postgres` (postgres-js) + `drizzle-orm` (schema in TS for types; DDL shipped as idempotent `db/schema.sql` executed on startup — no drizzle-kit needed at runtime; Supabase-compatible).
- **Flexibility**: local Docker Postgres OR Supabase, switched purely by `DATABASE_URL` env. `DB_SSL=require` for Supabase / `disable` for local; the client factory passes `ssl` to postgres-js explicitly.
- **No auth** (out of scope). Current user seeded `users.code='MK'` ("YOU").
- Repo layout at root `mythril/`: `web/` = the Next app, `docker-compose.yml`, `.env.example`, `README.md`.

## SOLID layering inside web/src/

```
src/
  domain/
    types.ts          # Project, Sprint, User, Issue, ChecklistItem, IssueDTO etc (SHARED, pre-written)
    repositories.ts   # repository INTERFACES (DIP: services depend on these only)
    errors.ts         # AppError hierarchy: NotFoundError, ValidationError, ConflictError
  infra/
    db/client.ts      # singleton postgres-js pool from DATABASE_URL/DB_SSL (SRP)
    db/schema.ts      # drizzle table defs (maps schema.sql)
    db/repositories/  # concrete Postgres repo implementations (OCP: swap/add here only)
    db/bootstrap.ts   # runSchema(): executes db/schema.sql; seedIfEmpty(): demo data
  services/
    board-service.ts  # use-cases (board fetch, create issue, move+reposition, checklist toggle…)
  app/
    layout.tsx page.tsx globals.css
    api/...           # thin HTTP handlers: parse (zod) → service → envelope json (SRP: no logic here)
  components/         # UI (see below)
  lib/api.ts store.tsx utils.ts
```

Envelope everywhere: `{success:boolean, message:string, data:any|null}`; errors → proper HTTP status + `{success:false,message}`.

## DB schema (idempotent DDL, contract for both SQL and drizzle)

```sql
users(code text PK, name text NOT NULL, avatar_color text NOT NULL)          -- MK/JT/AS/RP
projects(id serial PK, key text UNIQUE NOT NULL, name text NOT NULL)         -- 'NEBULA-OS'
sprints(id serial PK, project_id int FK->projects, number int, kicker text, title text,
        starts_at date, ends_at date, is_active bool DEFAULT true, UNIQUE(project_id, number))
issues(id serial PK, project_id int FK, key text UNIQUE NOT NULL,            -- 'MY-104'
       title text NOT NULL, description text NOT NULL DEFAULT '',
       priority text CHECK (priority IN ('HIGH','MED','LOW')),
       type text CHECK (type IN ('BUG','TASK')),
       status text CHECK (status IN ('todo','progress','review','shipped')),
       assignee text FK->users(code), position double precision NOT NULL DEFAULT 0,
       created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())
checklist_items(id serial PK, issue_id int FK->issues ON DELETE CASCADE, text text NOT NULL,
                done bool NOT NULL DEFAULT false, position int NOT NULL DEFAULT 0)
CREATE INDEX IF NOT EXISTS idx_issues_board ON issues(project_id, status, position);
```

Issue keys: prefix = project's demo prefix in seed (`MY-` for all three, matches export). New key = `{prefix}-{counter}` where counter = max numeric suffix across ALL issues + 1 (export behavior: global seq).

## REST API (same-origin, base `/api`) — handlers in `src/app/api/`

- `GET  /api/health` → data `{status:'ok', db:'ok'}` (500 if DB unreachable)
- `GET  /api/projects` → `[{id,key,name,activeSprint:{number,kicker,title,daysLeft}|null}]`
- `GET  /api/projects/:key/board` → `{project, sprint|null, users[], issues: IssueDTO[]}` (sorted status-order then position asc)
  - `IssueDTO={id,key,title,description,priority,type,status,assignee:{code,name,avatarColor},position,checklist:[{id,text,done,position}]}`
- `POST /api/projects/:key/issues` `{title,description?,priority,type,status,assignee,checklistTexts?:string[](max5)}` → 201 IssueDTO; defaults: description `Created from + New Issue · <date>`, checklist fallback `['Define scope','Add test']`
- `PATCH /api/issues/:id` partial `{title?,description?,priority?,type?,assignee?,status?}` → IssueDTO; status change w/o position → append to end of new column
- `PUT  /api/issues/:id/move` `{status, beforeIssueId:number|null}` → `{issues: IssueDTO[]}` (full board re-serialization; null=append). Reposition uses neighbor-average like: fetch column ordered by position, insert before target (or at end), position = midpoint of neighbors' positions, reindex column if degenerate.
- `POST /api/issues/:id/checklist` `{text}` → checklist item; cap 5 → 400
- `PATCH /api/checklist-items/:id` `{done:boolean}` → item
- `DELETE /api/issues/:id` → 204 success (NO delete button in UI — export has no delete affordance)
- zod validation → 400; unknown → 404; all through services (route handlers contain zero business logic).

## Seed (exact copies, idempotent ON CONFLICT DO NOTHING)

- users: `MK M. Kade yellow`, `JT J. Torres sky`, `AS A. Silva lav`, `RP R. Park coral`
- projects: **NEBULA-OS** sprint #14 (kicker "Active sprint · Feb 10 – Feb 24", title "Forge the sprint. Ship like legend.", 2026-02-10→ ends today+6d so chip shows "6 DAYS LEFT"), **PIXELFORGE** sprint #7, **APEX-API** sprint #3 (last two: EMPTY boards → exercise dashed "Drop cards here" state)
- issues MY-100..MY-109: EXACT title/desc/priority/type/status/assignee/checklist from `.req/mythril-dashboard.html` seed array; all checks done for MY-100 & MY-109, first check done for MY-102; positions in listed order per column.

## UI surface (client `page.tsx` under BoardProvider context)

All interactions from export must work 1:1:
1. 4-column board w/ padStart(2) counts; HTML5 drag&drop across+within column (dragover midpoint insertion, `.dragover` dashed outline, `.dragging` opacity) → optimistic + `PUT /move`.
2. Keyboard on focused card: ←/→ move column, ↑/↓ reorder within (visible `.card:focus-visible` ring).
3. Checklist toggle: mint cbox, strike-through `.done`, per-card progress bar/pct, sprint meter + stats (Open, High bugs=HIGH+BUG not shipped, In review, Shipped) all recomputed.
4. Filterbar: My issues (assignee MK), Urgent bugs (HIGH+BUG), search matches key or title (case-insens), `Showing x / y` note.
5. Dark mode toggle on `<html data-theme>`, persisted `localStorage`, topbar/dialog-head/logo invert per export dark rules.
6. New Issue modal (from export form): title, priority select, column select, type, assignee (MK shows "MK — You"), checklist textarea one/line max 5; Esc/backdrop close, focus trap, return focus, ⌘/Ctrl+Enter? (not in export — skip), validation: title required else "Untitled issue".
7. Project switcher dropdown (3 projects, active marked, click-outside closes) → fetch that board (loading state per switch).
8. Sprint chip with blinking dot + days left (server-computed `daysLeft`, client formats "N DAYS LEFT").
9. States: initial loading skeleton, fetch error w/ retry button, per-column empty state, optimistic update w/ revert on API failure.
10. Responsive exactly as export (`max-width:1080px`→2col, `640px`→1col, form-row collapses), no horizontal scroll @360px, min 44px touch targets preserved.
11. Prototype chrome cleanup: keep `data-od-id` OFF production markup; copy/text stays verbatim (© MYTHRIL · SPRINT #14 footer etc).

## Docker / env

- `web/Dockerfile`: multi-stage node:22-alpine, pnpm/npm ci, `NEXT_TELEMETRY_DISABLED=1`, standalone runner, non-root, entrypoint runs bootstrap(schema+seed) then `node server.js`.
- `docker-compose.yml`: services `web (3000)` + `db (postgres:16-alpine, profile "local-db", volume pgdata, healthcheck)`. Supabase path: `docker compose up -d web` with external URL.
- `.env.example`: documents both modes (see SPEC session output).

## Agent ownership (no overlapping files)

- **BE agent**: `src/domain/*` (interfaces per pre-written types), `src/infra/**`, `src/services/**`, `src/app/api/**`, `db/schema.sql`, package deps additions, `vitest` tests for service+repo w/ fake repo (DIP proof) + schema/seed integration test vs local pg if reachable (skip gracefully).
- **FE agent**: `src/app/layout.tsx page.tsx globals.css`, `src/components/**`, `src/lib/**`, Tailwind config + tokens; may MOCK `/api` via local fake fetch while building (tests: `tsc --noEmit`, eslint, `next build`).
- Neither touches the other's files. Root compose/env/README handled by orchestrator.
