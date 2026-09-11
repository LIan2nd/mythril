# MYTHRIL — Sprint Kanban Dashboard

Full-stack **Next.js 15** (App Router + Route Handlers) + **PostgreSQL**, built from `.req/mythril-dashboard.html` (neo-brutalist design contract). Runs directly against your local Postgres today; flips to **Supabase** (or any hosted Postgres) by editing one env value. No Docker required.

## One env variable to move environments

Config lives inside `web/` so the app folder is self-contained (and ready for Vercel, whose project root will be `web/`):

```
web/.env.example   # template — the only env file committed
web/.env.local     # your real values (git-ignored, auto-loaded by Next)
```

Resolution in code (`web/src/infra/db/client.ts`): **`DB_URL`** → `DATABASE_URL` (compat alias) → built-in fallback `postgresql://mythril:***@localhost:5432/mythril`. TLS via `DB_SSL=require|no-verify|disable` or `?sslmode=` in the URL. Supabase **transaction pooler** (port `6543`, `?pgbouncer=true`) is auto-detected — prepared statements are disabled so PgBouncer never chokes. `instrumentation.ts` then applies schema + demo seed automatically on server start (idempotent; serverless-safe).

## One-time local Postgres setup

```bash
psql -d template1 -c "CREATE ROLE mythril LOGIN PASSWORD 'mythril'"
psql -d template1 -c "CREATE DATABASE mythril OWNER mythril"
```

## Run it

```bash
cd web
npm install                    # first time only
cp .env.example .env.local     # tweak if your DSN differs; defaults already match
npm run dev                    # http://localhost:3000
```

First request boots `bootstrapDb()` → tables + sprint #14 demo data created in your local database.

## Deploy to Vercel (Supabase data path)

1. Vercel → New Project → **Root Directory = `web`**.
2. Project → Settings → Environment Variables (all environments):
   - `DB_URL` = your Supabase DSN — Settings → Database → Connection string; use the **session** pooler `:5432` or direct IPv4 (the transaction pooler `:6543` works too with `&pgbouncer=true`).
   - `DB_SSL` = `require` (or let the URL carry `?sslmode=require`).
3. Deploy. Vercel does not read repo env files — dashboard values win; the app migrates + seeds Supabase on first cold start.

Tip: co-locate regions (e.g. Vercel `sin1` ↔ Supabase ap-southeast-1).

## Tests

```bash
cd web
npm test        # 31 unit tests — fake repos, no database, CI-friendly
npm run test:db # 6 live integration tests; set DB_URL=... to aim them,
                # else defaults to the local mythril/mythril db
```

## Architecture (SOLID)

```
web/src/
  domain/      # types, repository interfaces, AppError taxonomy — pure, no I/O
  infra/db/    # postgres-js client (TLS + PgBouncer aware), idempotent DDL/seed, repos
  services/    # board/issue/checklist use-cases; repos injected via constructor (DIP)
  app/api/     # 9 route handlers: zod parse → service → {success,message,data}
  app/ lib/ components/   # UI: 1:1 port of the export with optimistic updates
```

Persistence is swappable at exactly one seam (`domain/repositories.ts`); unit tests run the full service stack against in-memory fakes.

## Design fidelity contract

See `.req/DESIGN-HANDOFF.md` — tokens, 3px borders, hard `5px 5px` shadows, Arial Black display type, responsive matrix (≤1080 → 2-col, ≤640 → 1-col), focus/hover/pressed states, real copy preserved; all static placeholders replaced with live CRUD.

> The earlier Docker Compose self-host setup (local Postgres container + `web`/`db` services) is recoverable with `git show 4d9f4c3:docker-compose.yml` if you ever want it back.
