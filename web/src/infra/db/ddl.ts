import type { ParameterOrJSON } from 'postgres';
import { DEFAULT_COLUMNS } from '@/domain/types';
import { hashPassword } from '../../server/auth/crypto';

export const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS users (
  code text PRIMARY KEY,
  name text NOT NULL,
  avatar_color text NOT NULL,
  username text,
  password_hash text,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active',
  display_name text,
  avatar bytea,
  avatar_type text,
  avatar_updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS projects (
  id serial PRIMARY KEY,
  key text UNIQUE NOT NULL,
  name text NOT NULL
);
CREATE TABLE IF NOT EXISTS board_columns (
  id serial PRIMARY KEY,
  project_id integer REFERENCES projects(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('backlog','active','review','done')),
  color text NOT NULL CHECK (color IN ('lavender','yellow','coral','mint','sky')),
  position integer NOT NULL
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'board_columns' AND column_name = 'project_id') THEN
    ALTER TABLE board_columns ADD COLUMN project_id integer REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'board_columns' AND column_name = 'id') THEN
    ALTER TABLE board_columns DROP CONSTRAINT IF EXISTS board_columns_pkey CASCADE;
    ALTER TABLE board_columns ADD COLUMN id serial PRIMARY KEY;
  END IF;
END $$;
DO $$ BEGIN
  ALTER TABLE board_columns ALTER COLUMN project_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'board_columns_project_key_unique') THEN
    ALTER TABLE board_columns ADD CONSTRAINT board_columns_project_key_unique UNIQUE (project_id, key);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'issues') THEN
    ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_fkey;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issues_project_status_fkey') THEN
    ALTER TABLE issues ADD CONSTRAINT issues_project_status_fkey FOREIGN KEY (project_id, status) REFERENCES board_columns(project_id, key) ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS project_members (
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_code text NOT NULL REFERENCES users(code) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_code)
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'username') THEN ALTER TABLE users ADD COLUMN username text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash') THEN ALTER TABLE users ADD COLUMN password_hash text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role') THEN ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'member'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'status') THEN ALTER TABLE users ADD COLUMN status text NOT NULL DEFAULT 'active'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'display_name') THEN ALTER TABLE users ADD COLUMN display_name text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar') THEN ALTER TABLE users ADD COLUMN avatar bytea; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_type') THEN ALTER TABLE users ADD COLUMN avatar_type text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_updated_at') THEN ALTER TABLE users ADD COLUMN avatar_updated_at timestamptz; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id') THEN
  CREATE SEQUENCE IF NOT EXISTS users_id_seq;
  ALTER TABLE users ADD COLUMN id integer UNIQUE NOT NULL DEFAULT nextval('users_id_seq');
END IF; END $$;
UPDATE users SET username = lower(code) WHERE username IS NULL;
UPDATE users SET display_name = name WHERE display_name IS NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key') THEN ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username); END IF; END $$;
CREATE TABLE IF NOT EXISTS sprints (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number integer NOT NULL,
  kicker text,
  title text,
  starts_at date,
  ends_at date,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (project_id, number)
);
CREATE TABLE IF NOT EXISTS issues (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text CHECK (priority IN ('HIGH','MED','LOW')),
  type text CHECK (type IN ('BUG','TASK')),
  status text CHECK (status IN ('todo','progress','review','shipped')),
  assignee text REFERENCES users(code),
  position double precision NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
CREATE TABLE IF NOT EXISTS checklist_items (
  id serial PRIMARY KEY,
  issue_id integer NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_issues_board ON issues(project_id, status, position);
CREATE TABLE IF NOT EXISTS app_metadata (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
`;

export interface SeedStatement {
  sql: string;
  params: ParameterOrJSON<never>[];
}

export const ISSUE_KEY_PREFIX = 'MY';

export const SEED_USERS = [
  { code: 'MK', name: 'M. Kade', avatarColor: 'yellow' },
  { code: 'JT', name: 'J. Torres', avatarColor: 'sky' },
  { code: 'AS', name: 'A. Silva', avatarColor: 'lav' },
  { code: 'RP', name: 'R. Park', avatarColor: 'coral' },
] as const;

/** Fixed-salt scrypt hashes (params in server/auth/crypto.ts); never plaintext. */
export const DEMO_PASSWORD_HASH = hashPassword('mythril');
export const ADMIN_PASSWORD_HASH = hashPassword('admin123');

export const ADMIN_SEED_USER = {
  code: 'AD',
  displayName: 'Admin',
  avatarColor: 'sky',
  username: 'admin',
  role: 'admin',
  status: 'active',
} as const;

export const SEED_PROJECTS = [
  { key: 'NEBULA-OS', name: 'NEBULA-OS' },
  { key: 'PIXELFORGE', name: 'PIXELFORGE' },
  { key: 'APEX-API', name: 'APEX-API' },
] as const;

export const SEED_SPRINTS = [
  {
    projectKey: 'NEBULA-OS',
    number: 14,
    kicker: 'Active sprint · Feb 10 – Feb 24',
    title: 'Forge the sprint. Ship like legend.',
    startsAt: '2026-02-10',
    endsAt: '2026-02-24',
    isActive: true,
  },
  {
    projectKey: 'PIXELFORGE',
    number: 7,
    kicker: 'Sprint #7',
    title: 'Forge the sprint. Ship like legend.',
    startsAt: '2026-02-10',
    endsAt: '2026-02-24',
    isActive: true,
  },
  {
    projectKey: 'APEX-API',
    number: 3,
    kicker: 'Sprint #3',
    title: 'Forge the sprint. Ship like legend.',
    startsAt: '2026-02-10',
    endsAt: '2026-02-24',
    isActive: true,
  },
] as const;

interface SeedCheck {
  text: string;
  done: boolean;
}

interface SeedIssue {
  key: string;
  status: 'todo' | 'progress' | 'review' | 'shipped';
  priority: 'HIGH' | 'MED' | 'LOW';
  type: 'BUG' | 'TASK';
  title: string;
  description: string;
  assignee: string;
  position: number;
  checks: SeedCheck[];
}

function c(text: string, done = false): SeedCheck {
  return { text, done };
}

export const SEED_ISSUES: SeedIssue[] = [
  {
    key: 'MY-100',
    status: 'shipped',
    priority: 'MED',
    type: 'TASK',
    title: 'Seed sprint #14 board data',
    description: 'Fixtures for demo + filter QA.',
    assignee: 'AS',
    position: 1,
    checks: [c('10 cards', true), c('Counts wired', true)],
  },
  {
    key: 'MY-101',
    status: 'progress',
    priority: 'HIGH',
    type: 'BUG',
    title: 'Kanban drag drops wrong index',
    description: 'Dropping between cards inserts at top on Safari.',
    assignee: 'JT',
    position: 0,
    checks: [c('Repro on Safari 17'), c('Fix insertion index'), c('Verify touch fallback')],
  },
  {
    key: 'MY-102',
    status: 'progress',
    priority: 'MED',
    type: 'TASK',
    title: 'Sprint burndown widget',
    description: 'Wire shipped-count to header meter.',
    assignee: 'MK',
    position: 1,
    checks: [c('Compute shipped/total', true), c('Animate meter'), c('Persist filter state')],
  },
  {
    key: 'MY-103',
    status: 'review',
    priority: 'HIGH',
    type: 'BUG',
    title: 'Checkout total flickers on coupon',
    description: 'Optimistic total reverts before server ack.',
    assignee: 'RP',
    position: 0,
    checks: [c('Lock optimistic path'), c('Snapshot test totals')],
  },
  {
    key: 'MY-104',
    status: 'todo',
    priority: 'HIGH',
    type: 'BUG',
    title: 'Avatar upload corrupts on retry',
    description: '500 on second POST when CDN token expires mid-flight.',
    assignee: 'MK',
    position: 0,
    checks: [c('Repro with expired token'), c('Guard retry with fresh signed URL'), c('Add e2e for double-submit')],
  },
  {
    key: 'MY-105',
    status: 'todo',
    priority: 'MED',
    type: 'TASK',
    title: 'Backlog grooming: empty states',
    description: 'Design + copy for zero-result filters.',
    assignee: 'AS',
    position: 1,
    checks: [c('Copy deck'), c('Illustration slot'), c('A11y pass')],
  },
  {
    key: 'MY-106',
    status: 'todo',
    priority: 'LOW',
    type: 'TASK',
    title: 'Lavender backlog tag audit',
    description: 'Normalize stale labels before sprint close.',
    assignee: 'RP',
    position: 2,
    checks: [c('Export tags'), c('Merge duplicates')],
  },
  {
    key: 'MY-107',
    status: 'progress',
    priority: 'MED',
    type: 'TASK',
    title: 'Dark mode token swap',
    description: 'Invert line + surface without losing contrast.',
    assignee: 'AS',
    position: 2,
    checks: [c('Map tokens'), c('Check coral on dark')],
  },
  {
    key: 'MY-108',
    status: 'review',
    priority: 'MED',
    type: 'TASK',
    title: 'Pixel-border avatar spec',
    description: 'Document stepped shadow recipe for roster.',
    assignee: 'JT',
    position: 1,
    checks: [c('Spec + sizes'), c('Storybook entry')],
  },
  {
    key: 'MY-109',
    status: 'shipped',
    priority: 'LOW',
    type: 'TASK',
    title: 'Modal focus trap',
    description: 'Trap tab inside New Issue dialog.',
    assignee: 'MK',
    position: 0,
    checks: [c('Trap tab', true), c('Esc closes', true), c('Return focus', true)],
  },
];

export function buildSeedStatements(): SeedStatement[] {
  const stmts: SeedStatement[] = [];

  stmts.push({
    sql: `INSERT INTO users (code, name, avatar_color) VALUES ${SEED_USERS.map(
      (_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`,
    ).join(', ')} ON CONFLICT (code) DO NOTHING`,
    params: SEED_USERS.flatMap((u) => [u.code, u.name, u.avatarColor]),
  });

  stmts.push({
    sql: `INSERT INTO projects (key, name) VALUES ${SEED_PROJECTS.map(
      (_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`,
    ).join(', ')} ON CONFLICT (key) DO NOTHING`,
    params: SEED_PROJECTS.flatMap((p) => [p.key, p.name]),
  });

  for (const p of SEED_PROJECTS) {
    stmts.push({
      sql: `INSERT INTO board_columns (project_id, key, label, kind, color, position)
        SELECT p.id, v.key, v.label, v.kind, v.color, v.position::int
        FROM projects p
        CROSS JOIN (VALUES ${DEFAULT_COLUMNS.map(
          (_, i) => `($${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5}, $${i * 5 + 6}::int)`,
        ).join(', ')}) AS v(key, label, kind, color, position)
        WHERE p.key = $1 AND NOT EXISTS (SELECT 1 FROM board_columns bc WHERE bc.project_id = p.id)
        ON CONFLICT (project_id, key) DO NOTHING`,
      params: [p.key, ...DEFAULT_COLUMNS.flatMap((c) => [c.key, c.label, c.kind, c.color, c.position])],
    });
  }

  stmts.push({
    sql: `INSERT INTO users (code, name, avatar_color, username, password_hash, role, status, display_name)
      SELECT $1, $2, $3, $4, $5, $6, $7, $8
      WHERE NOT EXISTS (SELECT 1 FROM users WHERE code = $1 OR username = $4)
      ON CONFLICT (code) DO NOTHING`,
    params: [
      ADMIN_SEED_USER.code,
      ADMIN_SEED_USER.displayName,
      ADMIN_SEED_USER.avatarColor,
      ADMIN_SEED_USER.username,
      ADMIN_PASSWORD_HASH,
      ADMIN_SEED_USER.role,
      ADMIN_SEED_USER.status,
      ADMIN_SEED_USER.displayName,
    ],
  });

  stmts.push({
    sql: `UPDATE users SET username = lower(code), display_name = name, password_hash = $1
      WHERE code = ANY($2::text[]) AND password_hash IS NULL`,
    params: [DEMO_PASSWORD_HASH, SEED_USERS.map((u) => u.code)],
  });

  stmts.push({
    sql: `UPDATE users SET password_hash = $1 WHERE username = $2 AND password_hash IS NULL`,
    params: [ADMIN_PASSWORD_HASH, 'admin'],
  });

  stmts.push({
    sql: `INSERT INTO project_members (project_id, user_code)
      SELECT p.id, u.code FROM projects p CROSS JOIN users u
      WHERE p.key = ANY($3::text[]) AND u.code = ANY($1::text[]) AND u.status = $2
      ON CONFLICT (project_id, user_code) DO NOTHING`,
    params: [SEED_USERS.map((u) => u.code), 'active', SEED_PROJECTS.map((p) => p.key)],
  });

  // Must run after the board_columns defaults above: FK creation validates existing issue rows.
  stmts.push({
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issues_project_status_fkey') THEN
        ALTER TABLE issues ADD CONSTRAINT issues_project_status_fkey FOREIGN KEY (project_id, status) REFERENCES board_columns(project_id, key) ON UPDATE CASCADE;
      END IF;
    END $$`,
    params: [],
  });

  for (const s of SEED_SPRINTS) {
    stmts.push({
      sql: `INSERT INTO sprints (project_id, number, kicker, title, starts_at, ends_at, is_active)
        SELECT id, $2, $3, $4,
          CASE WHEN $7 THEN CURRENT_DATE + $8::int ELSE $5::date END,
          CASE WHEN $7 THEN CURRENT_DATE + $9::int ELSE $6::date END,
          $7
        FROM projects WHERE key = $1
        ON CONFLICT (project_id, number) DO NOTHING`,
      params: [s.projectKey, s.number, s.kicker, s.title, s.startsAt, s.endsAt, s.isActive, -8, 6],
    });
  }

  SEED_ISSUES.forEach((issue) => {
    stmts.push({
      sql: `INSERT INTO issues (project_id, key, title, description, priority, type, status, assignee, position)
        SELECT id, $1, $2, $3, $4, $5, $6, $7, $8 FROM projects WHERE key = $9
        ON CONFLICT (key) DO NOTHING`,
      params: [
        issue.key,
        issue.title,
        issue.description,
        issue.priority,
        issue.type,
        issue.status,
        issue.assignee,
        issue.position,
        'NEBULA-OS',
      ],
    });

    issue.checks.forEach((check, pos) => {
      stmts.push({
        sql: `INSERT INTO checklist_items (issue_id, text, done, position)
          SELECT i.id, $2, $3, $4 FROM issues i
          WHERE i.key = $1 AND NOT EXISTS (
            SELECT 1 FROM checklist_items WHERE issue_id = i.id AND position = $4
          )`,
        params: [issue.key, check.text, check.done, pos],
      });
    });
  });

  return stmts;
}
