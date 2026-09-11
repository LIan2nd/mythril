import { describe, expect, it } from 'vitest';
import {
  buildSeedStatements,
  SCHEMA_DDL,
  SEED_ISSUES,
  SEED_PROJECTS,
  SEED_SPRINTS,
  SEED_USERS,
  type SeedStatement,
} from '../../src/infra/db/ddl';

type Status = (typeof SEED_ISSUES)[number]['status'];

const stmts: SeedStatement[] = buildSeedStatements();
const issueStmts = stmts.filter((s) => /INSERT INTO issues/i.test(s.sql));
const checkStmts = stmts.filter((s) => /INSERT INTO checklist_items/i.test(s.sql));

function checksFor(key: string): { text: string; done: boolean }[] {
  return checkStmts
    .filter((s) => s.params[0] === key)
    .map((s) => ({ text: String(s.params[1]), done: Boolean(s.params[2]) }));
}

describe('SCHEMA_DDL', () => {
  it('is idempotent and complete', () => {
    for (const table of ['users', 'projects', 'sprints', 'issues', 'checklist_items']) {
      expect(SCHEMA_DDL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(SCHEMA_DDL).toContain('CREATE INDEX IF NOT EXISTS idx_issues_board ON issues(project_id, status, position)');
  });

  it('declares contract constraints', () => {
    expect(SCHEMA_DDL).toContain("priority IN ('HIGH','MED','LOW')");
    expect(SCHEMA_DDL).toContain("type IN ('BUG','TASK')");
    expect(SCHEMA_DDL).toContain("status IN ('todo','progress','review','shipped')");
    expect(SCHEMA_DDL).toContain('ON DELETE CASCADE');
  });
});

describe('seed statements', () => {
  it('are all parameterized with ON CONFLICT DO NOTHING', () => {
    const writeStmts = stmts.filter((s) => /INSERT/i.test(s.sql));
    expect(writeStmts.length).toBeGreaterThan(0);
    for (const s of writeStmts) {
      expect(s.sql).toMatch(/ON CONFLICT .*DO NOTHING|NOT EXISTS/i);
      expect(s.sql).not.toMatch(/'[^']*'/); // no single-quoted literals — values come from params
    }
  });

  it('seeds the 4 users and 3 projects from the export', () => {
    expect(SEED_USERS.map((u) => [u.code, u.name, u.avatarColor])).toEqual([
      ['MK', 'M. Kade', 'yellow'],
      ['JT', 'J. Torres', 'sky'],
      ['AS', 'A. Silva', 'lav'],
      ['RP', 'R. Park', 'coral'],
    ]);
    expect(SEED_PROJECTS.map((p) => p.key)).toEqual(['NEBULA-OS', 'PIXELFORGE', 'APEX-API']);
    expect(SEED_SPRINTS.map((s) => s.number)).toEqual([14, 7, 3]);
    expect(SEED_SPRINTS[0].kicker).toBe('Active sprint · Feb 10 – Feb 24');
    expect(SEED_SPRINTS[0].title).toBe('Forge the sprint. Ship like legend.');
    expect(SEED_SPRINTS[0].startsAt).toBe('2026-02-10');
    expect(SEED_SPRINTS[0].endsAt).toBe('2026-02-24');
  });

  it('seeds exactly 10 issues, keys MY-100..MY-109', () => {
    expect(issueStmts).toHaveLength(10);
    expect(SEED_ISSUES).toHaveLength(10);
    const keys = issueStmts.map((s) => String(s.params[0])).sort();
    expect(keys).toEqual(
      Array.from({ length: 10 }, (_, i) => `MY-${100 + i}`),
    );
  });

  it('carries MY-100 title/desc/assignee exactly as the export', () => {
    const my100 = SEED_ISSUES.find((i) => i.key === 'MY-100')!;
    expect(my100.title).toBe('Seed sprint #14 board data');
    expect(my100.description).toBe('Fixtures for demo + filter QA.');
    expect(my100.assignee).toBe('AS');
    expect(my100.priority).toBe('MED');
    expect(my100.type).toBe('TASK');
    const stmt = issueStmts.find((s) => s.params[0] === 'MY-100')!;
    expect(stmt.params[1]).toBe('Seed sprint #14 board data');
  });

  it('maps issue statuses to the documented column membership', () => {
    const expected: Record<Status, string[]> = {
      todo: ['MY-104', 'MY-105', 'MY-106'],
      progress: ['MY-101', 'MY-102', 'MY-107'],
      review: ['MY-103', 'MY-108'],
      shipped: ['MY-109', 'MY-100'],
    };
    // stmt params: [key, title, desc, priority, type, status, assignee, position, projectKey]
    for (const [status, keys] of Object.entries(expected)) {
      const actual = issueStmts.filter((s) => s.params[5] === status).map((s) => String(s.params[0]));
      expect(actual.sort()).toEqual([...keys].sort());
      const ordered = keys.map((k) => SEED_ISSUES.find((i) => i.key === k)!.position);
      expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
    }
    for (const i of SEED_ISSUES) {
      const stmt = issueStmts.find((s) => s.params[0] === i.key)!;
      expect(stmt.params[5]).toBe(i.status);
      expect(stmt.params[8]).toBe('NEBULA-OS');
    }
  });

  it('seeds checklist items with the documented done flags', () => {
    expect(checksFor('MY-100')).toEqual([
      { text: '10 cards', done: true },
      { text: 'Counts wired', done: true },
    ]);
    expect(checksFor('MY-109')).toEqual([
      { text: 'Trap tab', done: true },
      { text: 'Esc closes', done: true },
      { text: 'Return focus', done: true },
    ]);
    expect(checksFor('MY-102')).toEqual([
      { text: 'Compute shipped/total', done: true },
      { text: 'Animate meter', done: false },
      { text: 'Persist filter state', done: false },
    ]);
    expect(checksFor('MY-104')).toEqual([
      { text: 'Repro with expired token', done: false },
      { text: 'Guard retry with fresh signed URL', done: false },
      { text: 'Add e2e for double-submit', done: false },
    ]);
  });

  it('has deterministic keys with no runtime randomness', () => {
    expect(SCHEMA_DDL).not.toMatch(/Date\.now|random\(\)/);
    const rebuilt = buildSeedStatements();
    expect(JSON.stringify(rebuilt)).toEqual(JSON.stringify(stmts));
  });
});
