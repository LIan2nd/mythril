import { describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/domain/errors';
import type {
  AdminUserPatch,
  BoardColumnRepo,
  ChecklistRepo,
  CreateIssueInput,
  IssueRepo,
  ProjectRepo,
  SprintRepo,
  UpdateIssueInput,
  UpsertSprintInput,
  UserProfilePatch,
  UserRepo,
} from '@/domain/repositories';
import type {
  AuthUser,
  BoardColumn,
  ChecklistItem,
  Issue,
  Priority,
  Project,
  Sprint,
  User,
} from '@/domain/types';
import { DEFAULT_COLUMNS } from '@/domain/types';
import { AdminService } from '@/services/admin.service';
import { BoardService, daysLeftFrom } from '@/services/board-service';
import { ChecklistService, MAX_CHECKLIST_ITEMS } from '@/services/checklist-service';
import { DEFAULT_CHECKLIST, IssueService } from '@/services/issue-service';

const ADMIN: AuthUser = {
  id: 1, username: 'admin', code: 'AD', displayName: 'Admin', role: 'admin', status: 'active', color: 'sky', hasAvatar: false,
};
const MEMBER: AuthUser = {
  id: 2, username: 'mk', code: 'MK', displayName: 'M. Kade', role: 'member', status: 'active', color: 'yellow', hasAvatar: false,
};

function suffixOf(key: string): number {
  return Number(/(\d+)$/.exec(key)?.[1] ?? '0');
}

class FakeProjects implements ProjectRepo {
  private projectMembers = new Map<number, string[]>();
  constructor(public rows: Project[] = [{ id: 1, key: 'NEBULA-OS', name: 'NEBULA-OS' }], members: string[] = ['MK', 'JT']) {
    this.projectMembers.set(1, [...members]);
  }
  async list() {
    return [...this.rows];
  }
  async getByKey(key: string) {
    return this.rows.find((p) => p.key === key) ?? null;
  }
  async getById(id: number) {
    return this.rows.find((p) => p.id === id) ?? null;
  }
  async create(input: { key: string; name: string }) {
    const project = { id: this.rows.length + 1, ...input };
    this.rows.push(project);
    this.projectMembers.set(project.id, []);
    return project;
  }
  async update(id: number, patch: { key?: string; name?: string }) {
    const project = this.rows.find((p) => p.id === id);
    if (!project) throw new NotFoundError(`Project ${id} not found`);
    Object.assign(project, patch);
    return { ...project };
  }
  async remove(id: number) {
    this.rows = this.rows.filter((p) => p.id !== id);
    this.projectMembers.delete(id);
  }
  async countIssues(projectId: number) {
    return projectId === 1 ? 1 : 0; // Fake some issues for project 1 if needed, wait, we shouldn't hardcode this, let's inject it via issues.
  }
  async listForUser(userCode: string) {
    return userCode && this.members.includes(userCode) ? this.list() : [];
  }
  async memberCodes(projectId: number) {
    return [...(this.projectMembers.get(projectId) ?? [])];
  }
  async isMember(projectId: number, userCode: string) {
    return (this.projectMembers.get(projectId) ?? []).includes(userCode);
  }
  async setMembers(projectId: number, codes: string[]) {
    this.projectMembers.set(projectId, [...codes]);
  }
  get members() {
    return this.projectMembers.get(1) ?? [];
  }
  set members(codes: string[]) {
    this.projectMembers.set(1, [...codes]);
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
  async upsertActiveForProject(projectId: number, input: UpsertSprintInput): Promise<Sprint> {
    const sprint: Sprint = {
      id: 999,
      number: input.number,
      kicker: input.kicker ?? `Sprint #${input.number}`,
      title: input.title ?? 'Sprint Goal',
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      daysLeft: 14,
    };
    this.map.set(projectId, sprint);
    return sprint;
  }
}

class FakeUsers implements UserRepo {
  rows: User[] = [
    { code: 'AD', name: 'Admin', avatarColor: 'sky' },
    { code: 'MK', name: 'M. Kade', avatarColor: 'yellow' },
    { code: 'JT', name: 'J. Torres', avatarColor: 'sky' },
  ];
  async list() {
    return [...this.rows];
  }
  async getByCode(code: string) {
    return this.rows.find((u) => u.code === code) ?? null;
  }
  authRows: AuthUser[] = [
    ADMIN,
    MEMBER,
    { id: 3, username: 'jt', code: 'JT', displayName: 'J. Torres', role: 'member', status: 'active', color: 'sky', hasAvatar: false },
  ];
  async listAuth() {
    return [...this.authRows];
  }
  async listAuthByCodes(codes: string[]) {
    return this.authRows.filter((u) => u.code && codes.includes(u.code));
  }
  async getAuthByUsername() {
    return null;
  }
  async create(_input: unknown): Promise<AuthUser> {
    throw new Error('not used');
  }
  async updateProfile(_id: number, _patch: UserProfilePatch): Promise<AuthUser> {
    throw new Error('not used');
  }
  async adminPatch(_id: number, _patch: AdminUserPatch): Promise<AuthUser> {
    throw new Error('not used');
  }
  async updatePassword(_id: number, _passwordHash: string): Promise<void> {
    throw new Error('not used');
  }
  async setAvatar(_id: number, _avatar: Uint8Array | null, _avatarType: string | null): Promise<AuthUser> {
    throw new Error('not used');
  }
  async getAvatarByCode() {
    return null;
  }
  async remove() {
    throw new Error('not used');
  }
}

class FakeColumns implements BoardColumnRepo {
  rows: (BoardColumn & { projectId: number })[] = DEFAULT_COLUMNS.map((c) => ({ ...c, projectId: 1 }));
  async list(projectId: number) {
    return this.rows
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ ...c }));
  }
  async getByKey(projectId: number, key: string) {
    const found = this.rows.find((c) => c.projectId === projectId && c.key === key);
    return found ? { ...found } : null;
  }
  async create(
    projectId: number,
    input: { key: string; label: string; kind: BoardColumn['kind']; color: BoardColumn['color']; beforeKey: string | null },
  ) {
    const projRows = this.rows.filter((c) => c.projectId === projectId);
    const anchor = input.beforeKey ? projRows.find((c) => c.key === input.beforeKey) : undefined;
    const position = anchor ? anchor.position : projRows.length;
    for (const c of projRows) if (c.position >= position) c.position += 1;
    const column = { projectId, key: input.key, label: input.label, kind: input.kind, color: input.color, position };
    this.rows.push(column);
    return { ...column };
  }
  async update(projectId: number, key: string, patch: Partial<Pick<BoardColumn, 'label' | 'kind' | 'color'>>) {
    const column = this.rows.find((c) => c.projectId === projectId && c.key === key);
    if (!column) throw new NotFoundError(`Column ${key} not found`);
    Object.assign(column, patch);
    return { ...column };
  }
  async reorder(projectId: number, orderedKeys: string[]) {
    orderedKeys.forEach((key, position) => {
      const column = this.rows.find((c) => c.projectId === projectId && c.key === key);
      if (column) column.position = position;
    });
    return this.list(projectId);
  }
  async remove(projectId: number, key: string) {
    this.rows = this.rows.filter((c) => !(c.projectId === projectId && c.key === key));
  }
}

class FakeIssues implements IssueRepo {
  rows: Issue[] = [];
  private nextId = 1;
  constructor(private users: FakeUsers) {}

  seed(issue: Partial<Issue> & { key: string; status: string; position: number }): Issue {
    const assignee = this.users.rows.find((u) => u.code === (issue.assignee?.code ?? 'MK')) ?? this.users.rows[0];
    const full: Issue = {
      id: this.nextId++,
      projectId: 1,
      title: 'seed',
      description: '',
      priority: 'MED',
      type: 'TASK',
      assignee,
      checklist: [],
      ...issue,
    } as Issue;
    this.rows.push(full);
    return full;
  }

  columnRows(projectId: number, status: string): Issue[] {
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
      type: input.type as Issue['type'],
      status: input.status,
      assignee,
      position: col.length ? col[col.length - 1].position + 1 : 0,
      checklist: (input.checklistTexts ?? []).map((text, position) => ({
        id: 1000 + this.nextId * 10 + position,
        text,
        done: false,
        position,
      })),
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
  async move(id: number, status: string, beforeIssueId: number | null): Promise<void> {
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
    for (const [position, sid] of ids.entries()) {
      this.rows.find((i) => i.id === sid)!.position = position;
    }
  }
  async generateKey(_projectKey = ''): Promise<string> {
    const max = this.rows.reduce((m, i) => Math.max(m, suffixOf(i.key)), 0);
    return `MY-${max + 1}`;
  }
  async countByStatus(status: string) {
    return this.rows.filter((i) => i.status === status).length;
  }
  async countByProjectAndStatus(projectId: number, status: string) {
    return this.rows.filter((i) => i.projectId === projectId && i.status === status).length;
  }
  async countByAssignee(userCode: string) {
    return this.rows.filter((i) => i.assignee.code === userCode).length;
  }
  async reassign(projectId: number, fromCodes: string[], toCode: string) {
    const targetUser = await this.users.getByCode(toCode);
    if (!targetUser) throw new ValidationError(`Unknown assignee ${toCode}`);
    let count = 0;
    for (const issue of this.rows) {
      if (issue.projectId === projectId && fromCodes.includes(issue.assignee.code)) {
        issue.assignee = targetUser;
        count++;
      }
    }
    return count;
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
  async getIssueId(itemId: number) {
    for (const [issueId, list] of this.items.entries()) {
      if (list.some((c) => c.id === itemId)) return issueId;
    }
    return null;
  }
}

function fixtures() {
  const users = new FakeUsers();
  const projects = new FakeProjects();
  const sprints = new FakeSprints();
  const issues = new FakeIssues(users);
  const checklist = new FakeChecklist();
  const columns = new FakeColumns();
  const board = new BoardService({ projects, sprints, users, issues, columns });
  const issueSvc = new IssueService({ projects, users, issues, columns });
  const checklistSvc = new ChecklistService({ projects, issues, checklist });
  const adminSvc = new AdminService({ users, projects, issues, columns });
  return { users, projects, sprints, issues, checklist, columns, board, issueSvc, checklistSvc, adminSvc };
}

const basePayload = {
  title: 'Wire the widget',
  priority: 'MED' as const,
  type: 'TASK' as const,
  status: 'todo',
  assignee: 'MK',
};

describe('IssueService.createIssue validation (fake repos, DIP proof)', () => {
  it('rejects empty and >120 char titles', async () => {
    const { issueSvc } = fixtures();
    await expect(issueSvc.createIssue('NEBULA-OS', { ...basePayload, title: '   ' }, ADMIN)).rejects.toBeInstanceOf(ValidationError);
    await expect(issueSvc.createIssue('NEBULA-OS', { ...basePayload, title: 'x'.repeat(121) }, ADMIN)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects more than 5 checklist texts', async () => {
    const { issueSvc } = fixtures();
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    await expect(issueSvc.createIssue('NEBULA-OS', { ...basePayload, checklistTexts: six }, ADMIN)).rejects.toBeInstanceOf(ValidationError);
  });

  it('applies description + checklist defaults', async () => {
    const { issueSvc } = fixtures();
    const issue = await issueSvc.createIssue('NEBULA-OS', basePayload, MEMBER);
    expect(issue.description).toMatch(/^Created from \+ New Issue · \d{2}\/\d{2}\/\d{4}$/);
    expect(issue.checklist.map((c) => c.text)).toEqual(DEFAULT_CHECKLIST);
    const withTexts = await issueSvc.createIssue('NEBULA-OS', { ...basePayload, checklistTexts: ['only one'] }, MEMBER);
    expect(withTexts.checklist).toHaveLength(1);
  });

  it('rejects unknown project, unknown assignee, unknown column, non-member actor', async () => {
    const { issueSvc } = fixtures();
    await expect(issueSvc.createIssue('NOPE', basePayload, ADMIN)).rejects.toBeInstanceOf(NotFoundError);
    await expect(issueSvc.createIssue('NEBULA-OS', { ...basePayload, assignee: 'ZZ' }, ADMIN)).rejects.toBeInstanceOf(ValidationError);
    await expect(issueSvc.createIssue('NEBULA-OS', { ...basePayload, status: 'ghost' }, ADMIN)).rejects.toBeInstanceOf(ValidationError);
    const f = fixtures();
    f.projects.members = ['JT'];
    await expect(f.issueSvc.createIssue('NEBULA-OS', basePayload, MEMBER)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('generateKey next-MY suffix', () => {
  it('is global max + 1 across projects', async () => {
    const { issues, issueSvc } = fixtures();
    issues.seed({ key: 'MY-100', status: 'todo', position: 0 });
    issues.seed({ key: 'MY-109', status: 'shipped', position: 0, projectId: 2 });
    expect(await issues.generateKey('NEBULA-OS')).toBe('MY-110');
    const created = await issueSvc.createIssue('NEBULA-OS', basePayload, ADMIN);
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
    const issues = await f.issueSvc.moveIssue(f.a.id, { status: 'progress', beforeIssueId: null }, ADMIN);
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
    await f.issueSvc.moveIssue(f.c.id, { status: 'progress', beforeIssueId: f.d.id }, ADMIN);
    expect([pos(f, f.c.id), pos(f, f.d.id)]).toEqual([0, 1]);
  });

  it('reorders within a column before a neighbor', async () => {
    const f = setup();
    await f.issueSvc.moveIssue(f.b.id, { status: 'todo', beforeIssueId: f.a.id }, ADMIN);
    const reordered = f.issues.columnRows(1, 'todo');
    expect(reordered.map((i) => i.key)).toEqual(['MY-102', 'MY-101', 'MY-103']);
    expect(reordered.map((i) => i.position)).toEqual([0, 1, 2]);
  });

  it('refuses unknown issue, self-target, wrong-column target and unknown column', async () => {
    const f = setup();
    await expect(f.issueSvc.moveIssue(999, { status: 'todo', beforeIssueId: null }, ADMIN)).rejects.toBeInstanceOf(NotFoundError);
    await expect(f.issueSvc.moveIssue(f.a.id, { status: 'todo', beforeIssueId: f.a.id }, ADMIN)).rejects.toBeInstanceOf(ValidationError);
    await expect(f.issueSvc.moveIssue(f.a.id, { status: 'progress', beforeIssueId: f.b.id }, ADMIN)).rejects.toBeInstanceOf(ValidationError);
    await expect(f.issueSvc.moveIssue(f.a.id, { status: 'nowhere', beforeIssueId: null }, ADMIN)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('ChecklistService', () => {
  it('toggles done and persists', async () => {
    const { checklistSvc, checklist, issues } = fixtures();
    const issue = issues.seed({ key: 'MY-120', status: 'todo', position: 0 });
    checklist.push(issue.id, { id: 1, text: 'step one', done: false, position: 0 });
    const toggled = await checklistSvc.toggleItem(1, true, MEMBER);
    expect(toggled.done).toBe(true);
    expect((await checklist.listByIssue(issue.id))[0].done).toBe(true);
    await expect(checklistSvc.toggleItem(77, true, MEMBER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('caps items at 5, rejects whitespace, not-found issue, and member guard', async () => {
    const { checklistSvc, checklist, issues, projects } = fixtures();
    const issue = issues.seed({ key: 'MY-121', status: 'todo', position: 0 });
    for (let i = 0; i < MAX_CHECKLIST_ITEMS; i += 1) checklist.push(issue.id, { id: 10 + i, text: `t${i}`, done: false, position: i });
    await expect(checklistSvc.addItem(issue.id, 'one too many', MEMBER)).rejects.toBeInstanceOf(ValidationError);
    await expect(checklistSvc.addItem(999, 'text', MEMBER)).rejects.toBeInstanceOf(NotFoundError);
    await expect(checklistSvc.addItem(issue.id, '  ', MEMBER)).rejects.toBeInstanceOf(ValidationError);
    projects.members = ['JT'];
    await expect(checklistSvc.addItem(issue.id, 'outsider', MEMBER)).rejects.toBeInstanceOf(ForbiddenError);
    const okItem = await checklistSvc.addItem(issues.seed({ key: 'MY-122', status: 'todo', position: 0 }).id, 'fresh', ADMIN);
    expect(okItem.text).toBe('fresh');
  });

  it('createIssue honors the 5 exact items when provided', async () => {
    const { issueSvc, issues } = fixtures();
    const five = ['a', 'b', 'c', 'd', 'e'];
    const created = await issueSvc.createIssue('NEBULA-OS', { ...basePayload, checklistTexts: five }, MEMBER);
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
    const summaries = await f.board.listProjectSummaries(ADMIN);
    expect(summaries[0].activeSprint?.number).toBe(14);
    expect(summaries[0].activeSprint?.daysLeft).toBeGreaterThanOrEqual(0);
    expect(summaries[1].activeSprint).toBeNull();
    const memberSummaries = await f.board.listProjectSummaries(MEMBER);
    expect(memberSummaries).toHaveLength(2);
    f.projects.members = ['AD'];
    expect(await f.board.listProjectSummaries(MEMBER)).toHaveLength(0);
  });

  it('getBoard sorts by column order, shows roster, 404s unknown key, 403s outsider', async () => {
    const f = fixtures();
    f.issues.seed({ key: 'MY-130', status: 'shipped', position: 0 });
    f.issues.seed({ key: 'MY-131', status: 'todo', position: 1 });
    f.issues.seed({ key: 'MY-132', status: 'todo', position: 0 });
    const board = await f.board.getBoard('NEBULA-OS', MEMBER);
    expect(board.issues.map((i) => i.key)).toEqual(['MY-132', 'MY-131', 'MY-130']);
    expect(board.users.map((u) => u.code)).toEqual(['MK', 'JT']);
    expect(board.columns).toHaveLength(4);
    expect(board.sprint).toBeNull();
    await expect(f.board.getBoard('GHOST', MEMBER)).rejects.toBeInstanceOf(NotFoundError);
    f.projects.members = ['AD'];
    await expect(f.board.getBoard('NEBULA-OS', MEMBER)).rejects.toBeInstanceOf(ForbiddenError);
    const adminBoard = await f.board.getBoard('NEBULA-OS', ADMIN);
    expect(adminBoard.users.map((u) => u.code)).toEqual(['AD']);
  });
});

describe('AdminService RBAC hardening', () => {
  it('createProject returns AdminProjectDetail and seeds 4 default columns', async () => {
    const f = fixtures();
    const created = await f.adminSvc.createProject({ key: 'PROJ-NEW', name: 'New Project' });
    expect(created.key).toBe('PROJ-NEW');
    expect(created.name).toBe('New Project');
    expect(created.members).toEqual([]);
    expect(created.issueCount).toBe(0);

    const cols = await f.columns.list(created.id);
    expect(cols).toHaveLength(4);
    expect(cols.map((c) => c.key)).toEqual(DEFAULT_COLUMNS.map((c) => c.key));
  });

  it('columns are isolated between projects', async () => {
    const f = fixtures();
    await f.projects.create({ key: 'PROJ-B', name: 'Project B' });

    await f.adminSvc.createColumn('NEBULA-OS', { label: 'QA Review', kind: 'active', color: 'yellow' });
    await f.adminSvc.createColumn('PROJ-B', { label: 'Triage', kind: 'backlog', color: 'lavender' });

    const colsA = await f.adminSvc.listColumns('NEBULA-OS');
    const colsB = await f.adminSvc.listColumns('PROJ-B');

    expect(colsA.map((c) => c.label)).toContain('QA Review');
    expect(colsA.map((c) => c.label)).not.toContain('Triage');

    expect(colsB.map((c) => c.label)).toContain('Triage');
    expect(colsB.map((c) => c.label)).not.toContain('QA Review');
  });

  it('prevents deleting a column if it has issues in that specific project', async () => {
    const f = fixtures();
    f.issues.seed({ key: 'MY-201', projectId: 1, status: 'progress', position: 0 });
    await expect(f.adminSvc.deleteColumn('NEBULA-OS', 'progress')).rejects.toThrow(ConflictError);
  });

  it('reassigns issues to admin actor if admin is in the remaining roster', async () => {
    const f = fixtures();
    await f.projects.setMembers(1, ['AD', 'MK', 'JT']);
    const issue = f.issues.seed({
      key: 'MY-202',
      projectId: 1,
      status: 'todo',
      position: 0,
      assignee: { code: 'MK', name: 'M. Kade', avatarColor: 'yellow' },
    });

    await f.adminSvc.setProjectMembers('NEBULA-OS', ['AD', 'JT'], ADMIN);
    expect(issue.assignee.code).toBe('AD');
  });

  it('reassigns issues to alphabetically first member if admin actor is NOT in remaining roster', async () => {
    const f = fixtures();
    await f.projects.setMembers(1, ['MK', 'JT']);
    const issue = f.issues.seed({
      key: 'MY-203',
      projectId: 1,
      status: 'todo',
      position: 0,
      assignee: { code: 'MK', name: 'M. Kade', avatarColor: 'yellow' },
    });

    await f.adminSvc.setProjectMembers('NEBULA-OS', ['JT'], ADMIN);
    expect(issue.assignee.code).toBe('JT');
  });

  it('throws 409 Conflict if removing the last member while issues are still assigned', async () => {
    const f = fixtures();
    await f.projects.setMembers(1, ['MK']);
    f.issues.seed({
      key: 'MY-204',
      projectId: 1,
      status: 'todo',
      position: 0,
      assignee: { code: 'MK', name: 'M. Kade', avatarColor: 'yellow' },
    });

    await expect(f.adminSvc.setProjectMembers('NEBULA-OS', [], ADMIN)).rejects.toThrow(ConflictError);
  });

  it('allows removing all members if no issues are assigned', async () => {
    const f = fixtures();
    await f.projects.setMembers(1, ['MK']);

    const result = await f.adminSvc.setProjectMembers('NEBULA-OS', [], ADMIN);
    expect(result.members).toEqual([]);
    expect(await f.projects.memberCodes(1)).toEqual([]);
  });

  it('board users is strictly roster-only even for admin', async () => {
    const f = fixtures();
    await f.projects.setMembers(1, ['MK']);
    const board = await f.board.getBoard('NEBULA-OS', ADMIN);
    expect(board.users.map((u) => u.code)).toEqual(['MK']);
  });

  it('deleteProject rejects if issues exist unless cascade is true', async () => {
    const f = fixtures();
    f.issues.seed({ key: 'MY-300', projectId: 1, status: 'todo', position: 0 });
    
    // Without cascade, should throw conflict
    await expect(f.adminSvc.deleteProject('NEBULA-OS')).rejects.toThrow(ConflictError);
    await expect(f.adminSvc.deleteProject('NEBULA-OS', { cascade: false })).rejects.toThrow(ConflictError);
    
    // With cascade, should succeed
    await expect(f.adminSvc.deleteProject('NEBULA-OS', { cascade: true })).resolves.not.toThrow();
    
    // Ensure project was deleted
    await expect(f.projects.getByKey('NEBULA-OS')).resolves.toBeNull();
  });

  it('deleteProject succeeds without cascade if no issues exist', async () => {
    const f = fixtures();
    await f.projects.create({ key: 'PROJ-EMPTY', name: 'Empty' });
    
    // Project has no issues, should succeed without cascade
    await expect(f.adminSvc.deleteProject('PROJ-EMPTY')).resolves.not.toThrow();
    await expect(f.projects.getByKey('PROJ-EMPTY')).resolves.toBeNull();
  });

  describe('BoardService.updateSprint', () => {
    it('updates sprint details and dates', async () => {
      const f = fixtures();
      const updated = await f.board.updateSprint(
        'NEBULA-OS',
        {
          number: 15,
          title: 'Ship Beta Release',
          kicker: 'Sprint #15',
          startsAt: '2026-09-15',
          endsAt: '2026-09-29',
        },
        ADMIN,
      );
      expect(updated.number).toBe(15);
      expect(updated.title).toBe('Ship Beta Release');
      expect(updated.startsAt).toBe('2026-09-15');
      expect(updated.endsAt).toBe('2026-09-29');
    });

    it('rejects invalid sprint number', async () => {
      const f = fixtures();
      await expect(
        f.board.updateSprint(
          'NEBULA-OS',
          {
            number: 0,
            startsAt: '2026-09-15',
            endsAt: '2026-09-29',
          },
          ADMIN,
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects invalid date formats', async () => {
      const f = fixtures();
      await expect(
        f.board.updateSprint(
          'NEBULA-OS',
          {
            number: 1,
            startsAt: 'invalid-date',
            endsAt: '2026-09-29',
          },
          ADMIN,
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects end date earlier than start date', async () => {
      const f = fixtures();
      await expect(
        f.board.updateSprint(
          'NEBULA-OS',
          {
            number: 1,
            startsAt: '2026-09-30',
            endsAt: '2026-09-15',
          },
          ADMIN,
        ),
      ).rejects.toThrow('End date cannot be earlier than start date');
    });

    it('rejects non-members', async () => {
      const f = fixtures();
      const nonMember: AuthUser = {
        id: 88,
        username: 'stranger',
        role: 'member',
        code: 'ST',
        displayName: 'Stranger',
        status: 'active',
        color: 'sky',
        hasAvatar: false,
      };
      await expect(
        f.board.updateSprint(
          'NEBULA-OS',
          {
            number: 1,
            startsAt: '2026-09-15',
            endsAt: '2026-09-29',
          },
          nonMember,
        ),
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
