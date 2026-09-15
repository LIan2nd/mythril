import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const GATE = process.env.MYTHRIL_DB_TESTS === '1';

const raw = (await import('@/services')).getServices();
const { bootstrapDb } = await import('@/infra/db/bootstrap');
const ACTOR = {
  id: 1, username: 'int-admin', code: 'IA', displayName: 'Integration Admin',
  role: 'admin', status: 'active', color: 'sky', hasAvatar: false,
} satisfies import('@/domain/types').AuthUser;
const db = {
  board: {
    getBoard: (key: string) => raw.board.getBoard(key, ACTOR),
    listProjectSummaries: () => raw.board.listProjectSummaries(ACTOR),
  },
  issue: {
    createIssue: (key: string, payload: import('@/domain/types').CreateIssuePayload) => raw.issue.createIssue(key, payload, ACTOR),
    updateIssue: (id: number, patch: import('@/domain/types').UpdateIssuePayload) => raw.issue.updateIssue(id, patch, ACTOR),
    deleteIssue: (id: number) => raw.issue.deleteIssue(id, ACTOR),
    moveIssue: (id: number, payload: import('@/domain/types').MoveIssuePayload) => raw.issue.moveIssue(id, payload, ACTOR),
  },
  checklist: {
    addItem: (issueId: number, text: string) => raw.checklist.addItem(issueId, text, ACTOR),
    toggleItem: (id: number, done: boolean) => raw.checklist.toggleItem(id, done, ACTOR),
  },
};

interface Cleanup {
  ids: number[];
}

const cleanup: Cleanup = { ids: [] };

describe.skipIf(!GATE)('postgres integration', () => {
  beforeAll(async () => {
    await bootstrapDb();
  });

  afterAll(async () => {
    for (const id of cleanup.ids) await db.issue.deleteIssue(id);
    const { getDb } = await import('@/infra/db/client');
    await getDb().end({ timeout: 5 });
  });

  it('bootstraps idempotently', async () => {
    await bootstrapDb();
    await bootstrapDb();
    const board = await db.board.getBoard('NEBULA-OS');
    expect(board.issues).toHaveLength(10);
    expect(board.users.map((u) => u.code).sort()).toEqual(['AS', 'JT', 'MK', 'RP']);
    expect(board.issues.map((i) => i.key).sort()).toEqual(
      ['MY-100', 'MY-101', 'MY-102', 'MY-103', 'MY-104', 'MY-105', 'MY-106', 'MY-107', 'MY-108', 'MY-109'].sort(),
    );
  });

  it('hydrates assignee and checklist ordering on the board', async () => {
    const board = await db.board.getBoard('NEBULA-OS');
    const mine = board.issues.find((i) => i.key === 'MY-100');
    expect(mine?.assignee.code).toBe('AS');
    expect(mine?.checklist.length).toBeGreaterThan(0);
    const todo = board.issues.filter((i) => i.status === 'todo');
    expect(todo.map((i) => i.key)).toEqual(['MY-104', 'MY-105', 'MY-106']);
  });

  it('rejects unknown projects', async () => {
    await expect(db.board.getBoard('DOES-NOT-EXIST')).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('creates, moves with renumbering, and deletes through the real repos', async () => {
    const base = { priority: 'LOW', type: 'TASK', assignee: 'MK' } as const;
    const a = await db.issue.createIssue('NEBULA-OS', { ...base, title: 'INT A', status: 'todo', checklistTexts: ['one'] });
    const b = await db.issue.createIssue('NEBULA-OS', { ...base, title: 'INT B', status: 'todo' });
    const c = await db.issue.createIssue('NEBULA-OS', { ...base, title: 'INT C', status: 'progress' });
    cleanup.ids.push(a.id, b.id, c.id);

    expect(a.key).toMatch(/^MY-\d+$/);
    const boardAfterCreate = await db.board.getBoard('NEBULA-OS');
    const todoKeys = boardAfterCreate.issues.filter((i) => i.status === 'todo').map((i) => i.key);
    expect(todoKeys).toEqual(['MY-104', 'MY-105', 'MY-106', a.key, b.key]);

    const moved = await db.issue.moveIssue(c.id, { status: 'todo', beforeIssueId: a.id });
    const todo = moved.filter((i) => i.status === 'todo');
    expect(todo.map((i) => i.key)).toEqual(['MY-104', 'MY-105', 'MY-106', c.key, a.key, b.key]);
    const positions = todo.map((i) => i.position);
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
    expect(new Set(positions).size).toBe(positions.length);

    const appended = await db.issue.moveIssue(b.id, { status: 'review', beforeIssueId: null });
    expect(appended.find((i) => i.key === b.key)?.status).toBe('review');
  });

  it('enforces the checklist cap against real data', async () => {
    const issue = await db.issue.createIssue('NEBULA-OS', {
      priority: 'MED',
      type: 'BUG',
      assignee: 'JT',
      status: 'todo',
      title: 'INT checklist cap',
      checklistTexts: ['c1', 'c2', 'c3', 'c4', 'c5'],
    });
    cleanup.ids.push(issue.id);
    expect(issue.checklist).toHaveLength(5);
    await expect(db.checklist.addItem(issue.id, 'c6')).rejects.toMatchObject({ name: 'ValidationError' });

    const toggled = await db.checklist.toggleItem(issue.checklist[0].id, true);
    expect(toggled.done).toBe(true);
    const after = await db.checklist.toggleItem(toggled.id, false);
    expect(after.done).toBe(false);
  });

  it('persists priority updates and cascades deletes from the DB', async () => {
    const issue = await db.issue.createIssue('NEBULA-OS', {
      priority: 'LOW',
      type: 'TASK',
      assignee: 'RP',
      status: 'shipped',
      title: 'INT persist',
      checklistTexts: ['persisted check'],
    });
    const updated = await db.issue.updateIssue(issue.id, { priority: 'HIGH' });
    expect(updated.priority).toBe('HIGH');

    await db.issue.deleteIssue(issue.id);
    const board = await db.board.getBoard('NEBULA-OS');
    expect(board.issues.find((i) => i.id === issue.id)).toBeUndefined();

    const { PostgresChecklistRepo } = await import('@/infra/db/repositories');
    const strays = await new PostgresChecklistRepo().listByIssue(issue.id);
    expect(strays).toEqual([]);
  });
});
