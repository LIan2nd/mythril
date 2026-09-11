# MYTHRIL — Sprint Kanban Dashboard

Full-stack **Next.js 15** (App Router + Route Handlers) with **PostgreSQL**, built from `.req/mythril-dashboard.html` (neo-brutalist design contract). The database layer is swappable to **Supabase** or any hosted Postgres via one env variable.

## Architecture (SOLID)

```
web/
  src/domain/      # types, repository interfaces, errors — pure, no I/O (DIP target)
  src/infra/db/    # postgres client (postgres-js + drizzle), migrations, repositories
  src/services/    # board/issue/checklist use-cases; take repo interfaces via DI
  src/app/api/     # Next route handlers: zod validation → service → {success,message,data}
  src/components/  # UI port of the design: board, cards, dialog, filters, banner
  src/lib/         # typed fetch client + BoardProvider store (optimistic updates)
```

- **DIP**: services depend on `src/domain/repositories.ts` interfaces; Postgres impls live in `src/infra/db/repositories/`. Switching engine or faking repos in tests touches neither.
- **Single env switch**: the same schema/DDL targets `DATABASE_URL` whether it resolves to the Docker container, your laptop, or the Supabase pooler. `DB_SSL=require` (or `?sslmode=require` in the URL) handles Supabase TLS.
- Schema applies + seeds automatically on first boot (after DB is reachable), so a fresh `docker compose up` lands you on the demo board.

## Quickstart — local Docker Postgres (default)

Requires: Docker + Docker Compose.

```bash
cp .env.example .env
docker compose up -d --build
```

Open **http://localhost:7111**. Services: `db` (postgres:16, host port 5433) and `web` (Next standalone, host port 7111). Data persists in the `mythril-pgdata` volume.

```bash
docker compose logs -f web     # startup, migrations, seeding
docker compose down                  # stop (volume keeps data)
docker compose down -v               # stop AND wipe the database volume
```

## Supabase / external Postgres

1. Create a Supabase project → **Settings → Database → Connection string** (use **Session pool** or direct IPv4, Postgres 15+/17 ok).
2. Edit `.env`:

```ini
COMPOSE_PROFILES=            # disables the local db container
DATABASE_URL=postgresql://postgres.<ref>:[PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
DB_SSL=require
```

3. `docker compose up -d web` — migrations + seed run against Supabase the same way.

> For Supabase's **transaction pooler (port 6543)** keep `?pgbouncer=true` off our stack: we don't use prepared statements, direct 5432 or session 5432 is recommended.

## Local development (outside Docker)

```bash
cd web && npm install
# host dev points at the compose db published on 127.0.0.1:5433
echo 'DATABASE_URL=postgresql://mythril:[email protected]:5433/mythril' > .env.local
npm run dev
```

`npm test` (vitest) runs service unit tests with fake repos — no DB needed. Integration tests run when `MYTHRIL_TEST_DATABASE_URL` is set.

```bash
docker compose up -d db   # just the Postgres container
```

## Design fidelity contract

See `.req/DESIGN-HANDOFF.md` — tokens (`:root` CSS vars), 3px borders, hard offset shadows, Arial Black display type, responsive matrix at 1080/640px, focus states, light/dark themes, and all copy/data are preserved 1:1; static placeholders are replaced with real CRUD wired to the API.
