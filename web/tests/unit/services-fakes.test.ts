import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '@/domain/errors';
import type {
  ChecklistRepo,
  CreateIssueInput,
  IssueRepo,
  ProjectRepo,
  SprintRepo,
  UpdateIssueInput,
  UserRepo,
} from '@/domain/repositories';
import type { ChecklistItem, ColumnId, Issue, IssueType, Priority, Project, Sprint, User } from '@/domain/types';
import { COLUMN_IDS } from '@/domain/types';
import { BoardService, daysLeftFrom } from '@/services/board-service';
import { ChecklistService, MAX_CHECKLIST_ITEMS } from '@/services/checklist-service';
import { DEFAULT_CHECKLIST, IssueService } from '@/services/issue-service';

class FakeProjects implements ProjectRepo {
  constructor(public rows: Project[] = [{ id: 1, key: 'NEBULA-OS', name: 'NEBULA-OS' }]) {}
  async list() {
    return [...this.rows];
  }
  async getByKey(key: string) {
    return this.rows.find((p) => p.key === key) ?? null;
  }
}

class FakeSprints implements SprintRepo {
  constructor(private map = new Map<number, Sprint>()) {}
  setActive(projectId: number, sprint: Sprint) {
    this.map.set(projectId, sprint);
  }
  async getActiveForProject(projectId: number) {
    return this.map.get(projectId) ?? null;
  }
}

class FakeUsers implements UserRepo {
  rows: User[] = [
    { code: 'MK', name: 'M. Kade', avatarColor: 'yellow' },
    { code: 'JT', name: 'J. Torres', avatarColor: 'sky' },
  ];
  async list() {
    return [...this.rows];
  }
  async getByCode(code: string) {
    return this.rows.find((u) => u.code === code) ?? null;
  }
}

function suffixOf(key: string): number {
  return Number(/(\d+)$/.exec(key)?.[1] ?? '0');
}

class FakeIssues implements IssueRepo {
  rows: Issue[] = [];
  private nextId = 1;
  constructor(private users: FakeUsers) {}

  seed(issue: Partial<Issue> & { key: string; status: ColumnId; position: number }): Issue {
    const user = this.users.rows.find((u) => u.code === (issue.assignee?.code ?? 'MK')) ?? this.users.rows[0];
    const full: Issue = {
      id: this.nextId++,
      projectId: 1,
      title: 'seed',
      description: '',
      priority: 'MED',
      type: 'TASK',
      assignee: user,
      checklist: [],
      ...issue,
    } as Issue;
    this.rows.push(full);
    return full;
  }

  columnRows(projectId: number, status: ColumnId): Issue[] {
    return this.rows
      .filter((i) => i.projectId === projectId && i.status === status)
      .sort((a, b) => a.position - b.position || a.id - b.id);
  }

  async listByProject(projectId: number) {
    return this.rows.filter((i) => i.projectId === projectId).map((i) => ({ ...i }));
  }
  async getById(id: number) {
    return this.rows.find((i) => i.id === id) ?? null;
  }
  async create(input: CreateIssueInput): Promise<Issue> {
    const assignee = await this.users.getByCode(input.assignee);
    if (!assignee) throw new ValidationError(`Unknown assignee ${input.assignee}`);
    const col = this.columnRows(input.projectId, input.status);
    const issue: Issue = {
      id: this.nextId++,
      key: await this.generateKey(''),
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? '',
      priority: input.priority as Priority,
      type: input.type as IssueType,
      status: input.status,
      assignee,
      position: col.length ? col[col.length - 1].position + 1 : 0,
      checklist: (input.checklistTexts ?? []).map((text, position) => ({ id: 1000 + this.nextId * 10 + position, text, done: false, position })),
    };
    this.rows.push(issue);
    return { ...issue };
  }
  async update(id: number, patch: UpdateIssueInput): Promise<Issue> {
    const issue = this.rows.find((i) => i.id === id);
    if (!issue) throw new NotFoundError(`Issue ${id} not found`);
    if (patch.title !== undefined) issue.title = patch.title;
    if (patch.description !== undefined) issue.description = patch.description;
    if (patch.priority !== undefined) issue.priority = patch.priority;
    if (patch.type !== undefined) issue.type = patch.type;
    if (patch.assignee !== undefined) {
      const user = await this.users.getByCode(patch.assignee);
      if (!user) throw new ValidationError(`Unknown assignee ${patch.assignee}`);
      issue.assignee = user;
    }
    if (patch.status !== undefined && patch.status !== issue.status) {
      issue.status = patch.status;
      const col = this.columnRows(issue.projectId, patch.status);
      issue.position = col.length ? col[col.length - 1].position + 1 : 0;
    }
    return { ...issue };
  }
  async remove(id: number) {
    const idx = this.rows.findIndex((i) => i.id === id);
    if (idx < 0) throw new NotFoundError(`Issue ${id} not found`);
    this.rows.splice(idx, 1);
  }
  async move(id: number, status: ColumnId, beforeIssueId: number | null): Promise<void> {
    const issue = this.rows.find((i) => i.id === id);
    if (!issue) throw new NotFoundError(`Issue ${id} not found`);
    if (beforeIssueId !== null) {
      if (beforeIssueId === id) throw new ValidationError('An issue cannot be moved before itself');
      const target = this.rows.find((i) => i.id === beforeIssueId);
      if (!target || target.projectId !== issue.projectId || target.status !== status) {
        throw new ValidationError(`Issue ${beforeIssueId} is not in column ${status}`);
      }
    }
    const ids = this.columnRows(issue.projectId, status)
      .map((i) => i.id)
      .filter((sid) => sid !== id);
    const index = beforeIssueId === null ? ids.length : Math.max(0, ids.indexOf(beforeIssueId));
    ids.splice(index, 0, id);
    issue.status = status;
    for (const [pos, sid] of ids.entries()) {
      this.rows.find((i) => i.id === sid)!.position = pos;
    }
  }
  async generateKey(_projectKey = ''): Promise<string> {
    const max = this.rows.reduce((m, i) => Math.max(m, suffixOf(i.key)), 0);
    return `MY-${max + 1}`;
  }
}

class FakeChecklist implements ChecklistRepo {
  items = new Map<number, ChecklistItem[]>();
  private nextId = 500;

  ofIssue(issueId: number): ChecklistItem[] {
    return this.items.get(issueId) ?? [];
  }
  push(issueId: number, item: ChecklistItem): void {
    const list = this.ofIssue(issueId);
    list.push(item);
    this.items.set(issueId, list);
  }
  async add(issueId: number, text: string): Promise<ChecklistItem> {
    const list = this.ofIssue(issueId);
    const item = { id: this.nextId++, text, done: false, position: list.length };
    this.push(issueId, item);
    return { ...item };
  }
  async toggle(id: number, done: boolean): Promise<ChecklistItem> {
    for (const list of this.items.values()) {
      const item = list.find((c) => c.id === id);
      if (item) {
        item.done = done;
        return { ...item };
      }
    }
    throw new NotFoundError(`Checklist item ${id} not found`);
  }
  async listByIssue(issueId: number): Promise<ChecklistItem[]> {
    return this.ofIssue(issueId).map((c) => ({ ...c }));
  }
}

function fixtures() {
  const users = new FakeUsers();
  const projects = new FakeProjects();
  const sprints = new FakeSprints();
  const issues = new FakeIssues(users);
  const checklist = new FakeChecklist();
  const board = new BoardService({ projects, sprints, users, issues });
  const issueSvc = new IssueService({ projects, users, issues });
  const checklistSvc = new ChecklistService({ issues, checklist });
  return { users, projects, sprints, issues, checklist, board, issueSvc, checklistSvc };
}

const basePayload = {
  title: 'Wire the widget',
  priority: 'MED' as const,
  type: 'TASK' as const,
  status: 'todo' as const,
  assignee: 'MK',
};

describe('IssueService.createIssue validation (fake repos, DIP proof)', () => {
  it('rejects empty and >120 char titles', async () => {
    const { issueSvc } = fixtures();
    await expect(issueSvc.createIssue('NEBULA-OS', { ...basePayload, title: '   ' })).rejects.toBeInstanceOf(ValidationError);
    await expect(issueSvc.createIssue('NEBULA-OS', { ...basePayload, title: 'x'.repeat(121) })).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects more than 5 checklist texts', async () => {
    const { issueSvc } = fixtures();
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    await expect(issueSvc.createIssue('NEBULA-OS', { ...basePayload, checklistTexts: six })).rejects.toBeInstanceOf(ValidationError);
  });

  it('applies description + checklist defaults', async () => {
    const { issueSvc } = fixtures();
    const issue = await issueSvc.createIssue('NEBULA-OS', basePayload);
    expect(issue.description).toMatch(/^Created from \+ New Issue · \d{2}\/\d{2}\/\d{4}$/);
    expect(issue.checklist.map((c) => c.text)).toEqual(DEFAULT_CHECKLIST);
    const withTexts = await issueSvc.createIssue('NEBULA-OS', { ...basePayload, checklistTexts: ['only one'] });
    expect(withTexts.checklist).toHaveLength(1);
  });

  it('rejects unknown project and unknown assignee with domain errors', async () => {
    const { issueSvc } = fixtures();
    await expect(issueSvc.createIssue('NOPE', basePayload)).rejects.toBeInstanceOf(NotFoundError);
    await expect(issueSvc.createIssue('NEBULA-OS', { ...basePayload, assignee: 'ZZ' })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('generateKey next-MY suffix', () => {
  it('is global max + 1 across projects', async () => {
    const { issues, issueSvc } = fixtures();
    issues.seed({ key: 'MY-100', status: 'todo', position: 0 });
    issues.seed({ key: 'MY-109', status: 'shipped', position: 0, projectId: 2 });
    expect(await issues.generateKey('NEBULA-OS')).toBe('MY-110');
    const created = await issueSvc.createIssue('NEBULA-OS', basePayload);
    expect(created.key).toBe('MY-110');
    expect(await issues.generateKey('PIXELFORGE')).toBe('MY-111');
  });
});

describe('move renumbering', () => {
  function setup() {
    const f = fixtures();
    const a = f.issues.seed({ key: 'MY-101', status: 'todo', position: 0 });
    const b = f.issues.seed({ key: 'MY-102', status: 'todo', position: 1 });
    const c = f.issues.seed({ key: 'MY-103', status: 'todo', position: 2 });
    const d = f.issues.seed({ key: 'MY-104', status: 'progress', position: 0 });
    return { ...f, a, b, c, d };
  }
  const pos = (f: ReturnType<typeof setup>, id: number) => f.issues.rows.find((i) => i.id === id)!.position;

  it('cross-column append renumbers the target column 0..n-1', async () => {
    const f = setup();
    const issues = await f.issueSvc.moveIssue(f.a.id, { status: 'progress', beforeIssueId: null });
    expect(pos(f, f.a.id)).toBe(1);
    expect(pos(f, f.d.id)).toBe(0);
    expect(issues.map((i) => [i.key, i.position])).toEqual([
      ['MY-102', 1],
      ['MY-103', 2],
      ['MY-104', 0],
      ['MY-101', 1],
    ]);
  });

  it('inserts immediately before the target issue', async () => {
    const f = setup();
    await f.issueSvc.moveIssue(f.c.id, { status: 'progress', beforeIssueId: f.d.id });
    expect([pos(f, f.c.id), pos(f, f.d.id)]).toEqual([0, 1]);
  });

  it('reorders within a column before a neighbor', async () => {
    const f = setup();
    await f.issueSvc.moveIssue(f.b.id, { status: 'todo', beforeIssueId: f.a.id });
    const reordered = f.issues.columnRows(1, 'todo');
    expect(reordered.map((i) => i.key)).toEqual(['MY-102', 'MY-101', 'MY-103']);
    expect(reordered.map((i) => i.position)).toEqual([0, 1, 2]);
  });

  it('refuses unknown issue, self-target and wrong-column target', async () => {
    const f = setup();
    await expect(f.issueSvc.moveIssue(999, { status: 'todo', beforeIssueId: null })).rejects.toBeInstanceOf(NotFoundError);
    await expect(f.issueSvc.moveIssue(f.a.id, { status: 'todo', beforeIssueId: f.a.id })).rejects.toBeInstanceOf(ValidationError);
    await expect(f.issueSvc.moveIssue(f.a.id, { status: 'progress', beforeIssueId: f.b.id })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('ChecklistService', () => {
  it('toggles done and persists', async () => {
    const { checklistSvc, checklist, issues } = fixtures();
    const issue = issues.seed({ key: 'MY-120', status: 'todo', position: 0 });
    checklist.push(issue.id, { id: 1, text: 'step one', done: false, position: 0 });
    const toggled = await checklistSvc.toggleItem(1, true);
    expect(toggled.done).toBe(true);
    expect((await checklist.listByIssue(issue.id))[0].done).toBe(true);
    await expect(checklistSvc.toggleItem(77, true)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('caps items at 5 and unknown issue not-found', async () => {
    const { checklistSvc, checklist, issues } = fixtures();
    const issue = issues.seed({ key: 'MY-121', status: 'todo', position: 0 });
    for (let i = 0; i < MAX_CHECKLIST_ITEMS; i += 1) checklist.push(issue.id, { id: 10 + i, text: `t${i}`, done: false, position: i });
    await expect(checklistSvc.addItem(issue.id, 'one too many')).rejects.toBeInstanceOf(ValidationError);
    await expect(checklistSvc.addItem(999, 'text')).rejects.toBeInstanceOf(NotFoundError);
    await expect(checklistSvc.addItem(issue.id, '  ')).rejects.toBeInstanceOf(ValidationError);
    const okItem = await checklistSvc.addItem(issues.seed({ key: 'MY-122', status: 'todo', position: 0 }).id, 'fresh');
    expect(okItem.text).toBe('fresh');
  });

  it('createIssue honors the 5 exact items when provided', async () => {
    const { issueSvc, issues } = fixtures();
    const five = ['a', 'b', 'c', 'd', 'e'];
    const created = await issueSvc.createIssue('NEBULA-OS', { ...basePayload, checklistTexts: five });
    expect(created.checklist.map((c) => c.text)).toEqual(five);
    void issues;
  });
});

describe('BoardService summaries + board', () => {
  const sprint = (endsAt: string): Sprint => ({
    id: 1, number: 14, kicker: 'k', title: 't', startsAt: '2026-02-10', endsAt, daysLeft: 999,
  });

  it('computes ceil-based daysLeft with min 0', () => {
    const now = new Date('2026-02-18T10:00:00Z');
    expect(daysLeftFrom('2026-02-24', now)).toBe(6);
    expect(daysLeftFrom('2026-02-19', now)).toBe(1);
    expect(daysLeftFrom('2026-02-18', now)).toBe(0);
    expect(daysLeftFrom('2020-01-01', now)).toBe(0);
  });

  it('lists summaries and null sprint when none active', async () => {
    const f = fixtures();
    f.sprints.setActive(1, sprint('2030-01-01'));
    f.projects.rows.push({ id: 2, key: 'APEX-API', name: 'APEX-API' });
    const summaries = await f.board.listProjectSummaries();
    expect(summaries[0].activeSprint?.number).toBe(14);
    expect(summaries[0].activeSprint?.daysLeft).toBeGreaterThanOrEqual(0);
    expect(summaries[1].activeSprint).toBeNull();
  });

  it('getBoard sorts by column order then position and 404s unknown key', async () => {
    const f = fixtures();
    f.issues.seed({ key: 'MY-130', status: 'shipped', position: 0 });
    f.issues.seed({ key: 'MY-131', status: 'todo', position: 1 });
    f.issues.seed({ key: 'MY-132', status: 'todo', position: 0 });
    const board = await f.board.getBoard('NEBULA-OS');
    expect(board.issues.map((i) => i.key)).toEqual(['MY-132', 'MY-131', 'MY-130']);
    expect(board.users).toHaveLength(2);
    expect(board.sprint).toBeNull();
    await expect(f.board.getBoard('GHOST')).rejects.toBeInstanceOf(NotFoundError);
    expect(COLUMN_IDS).toHaveLength(4);
  });
});
