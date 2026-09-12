// Shared domain contract — imported verbatim by UI and API layers (owned by orchestrator).

export const PRIORITIES = ['HIGH', 'MED', 'LOW'] as const;
export const ISSUE_TYPES = ['BUG', 'TASK'] as const;
export const COLUMN_KINDS = ['backlog', 'active', 'review', 'done'] as const;
export const COLUMN_COLORS = ['lavender', 'yellow', 'coral', 'mint', 'sky'] as const;
export const USER_STATUSES = ['pending', 'active', 'disabled', 'rejected'] as const;

export type Priority = (typeof PRIORITIES)[number];
export type IssueType = (typeof ISSUE_TYPES)[number];
export type ColumnKind = (typeof COLUMN_KINDS)[number];
export type ColumnColor = (typeof COLUMN_COLORS)[number];
export type Role = 'admin' | 'member';
export type UserStatus = (typeof USER_STATUSES)[number];

export interface BoardColumn {
  key: string;
  label: string;
  kind: ColumnKind;
  color: ColumnColor;
  position: number;
}

export interface User {
  code: string;
  name: string;
  avatarColor: string;
}

export interface AuthUser {
  id: number;
  username: string;
  code: string | null;
  displayName: string;
  role: Role;
  status: UserStatus;
  color: string;
  hasAvatar: boolean;
}

export interface AdminUserDetail extends AuthUser {
  createdAt?: string;
  requestedAt?: string;
  approvedAt?: string;
}

export interface ChecklistItem {
  id: number;
  text: string;
  done: boolean;
  position: number;
}

export interface Issue {
  id: number;
  key: string;
  projectId: number;
  title: string;
  description: string;
  priority: Priority;
  type: IssueType;
  status: string;
  assignee: User;
  position: number;
  checklist: ChecklistItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Sprint {
  id: number;
  number: number;
  kicker: string;
  title: string;
  startsAt: string;
  endsAt: string;
  daysLeft: number;
}

export interface Project {
  id: number;
  key: string;
  name: string;
}

export interface ProjectSummary extends Project {
  activeSprint: Pick<Sprint, 'number' | 'kicker' | 'title' | 'daysLeft'> | null;
}

export interface AdminProjectDetail extends Project {
  members: AuthUser[];
  issueCount: number;
}

export interface Board {
  project: Project;
  sprint: Sprint | null;
  users: AuthUser[];
  columns: BoardColumn[];
  issues: Issue[]; // column order, then position asc
}

export interface ApiOk<T> {
  success: true;
  message: string;
  data: T;
}
export interface ApiErr {
  success: false;
  message: string;
  data: null;
}
export type ApiResponse<T> = ApiOk<T> | ApiErr;

export interface CreateIssuePayload {
  title: string;
  description?: string;
  priority: Priority;
  type: IssueType;
  status: string;
  assignee: string;
  checklistTexts?: string[]; // max 5, server rejects beyond
}

export interface UpdateIssuePayload {
  title?: string;
  description?: string;
  priority?: Priority;
  type?: IssueType;
  assignee?: string;
  status?: string;
}

export interface MoveIssuePayload {
  status: string;
  beforeIssueId: number | null; // null = append to end of column
}

export interface UpsertChecklistPayload {
  text?: string;
  done?: boolean;
}

export interface LoginPayload {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequestPayload {
  username: string;
  displayName: string;
  password: string;
}

export interface ProfileUpdatePayload {
  username?: string;
  displayName?: string;
  color?: string;
}

export interface PasswordChangePayload {
  currentPassword: string;
  newPassword: string;
}

export interface AdminCreateUserPayload {
  username: string;
  displayName: string;
  password: string;
  role: Role;
  code?: string;
}

export interface AdminUpdateUserPayload {
  role?: Role;
  status?: UserStatus;
  displayName?: string;
  color?: string;
  code?: string;
  password?: string;
}

export interface CreateColumnPayload {
  label: string;
  kind: ColumnKind;
  color: ColumnColor;
  beforeKey?: string | null;
}

export type UpdateColumnPayload = Partial<Omit<CreateColumnPayload, 'beforeKey'>>;

export interface ReorderColumnsPayload {
  orderedKeys: string[];
}

export interface AdminProjectPayload {
  key: string;
  name: string;
}

export interface ProjectMembersPayload {
  codes: string[];
}

export const COLUMN_LABELS: Record<string, string> = {
  todo: 'To Do',
  progress: 'In Progress',
  review: 'Code Review',
  shipped: 'Shipped',
};

export const DEFAULT_COLUMNS: BoardColumn[] = [
  { key: 'todo', label: 'To Do', kind: 'backlog', color: 'lavender', position: 0 },
  { key: 'progress', label: 'In Progress', kind: 'active', color: 'yellow', position: 1 },
  { key: 'review', label: 'Code Review', kind: 'review', color: 'coral', position: 2 },
  { key: 'shipped', label: 'Shipped', kind: 'done', color: 'mint', position: 3 },
];

export function columnIndexOf(columns: BoardColumn[], key: string): number {
  const at = columns.findIndex((c) => c.key === key);
  return at < 0 ? columns.length : at;
}

export function defaultColumnByKind(columns: BoardColumn[], kind: ColumnKind): BoardColumn | undefined {
  return columns.find((c) => c.kind === kind);
}

export function sortIssuesForBoard(issues: Issue[], columns: BoardColumn[]): Issue[] {
  return [...issues].sort((a, b) =>
    columnIndexOf(columns, a.status) - columnIndexOf(columns, b.status) || a.position - b.position || a.id - b.id,
  );
}

export interface SprintStats {
  total: number;
  done: number;
  open: number;
  highBugs: number;
  inReview: number;
  byColumn: Record<string, number>;
  pct: number;
}

export function computeSprintStats(issues: Issue[], columns: BoardColumn[]): SprintStats {
  const byColumn: Record<string, number> = {};
  for (const c of columns) byColumn[c.key] = 0;
  for (const i of issues) byColumn[i.status] = (byColumn[i.status] ?? 0) + 1;
  const total = issues.length;
  const doneKey = defaultColumnByKind(columns, 'done')?.key;
  const reviewKey = defaultColumnByKind(columns, 'review')?.key;
  const done = doneKey ? byColumn[doneKey] ?? 0 : 0;
  return {
    total,
    done,
    open: total - done,
    highBugs: issues.filter(
      (i) => i.priority === 'HIGH' && i.type === 'BUG' && (!doneKey || i.status !== doneKey),
    ).length,
    inReview: reviewKey ? byColumn[reviewKey] ?? 0 : 0,
    byColumn,
    pct: total ? Math.round((done / total) * 100) : 0,
  };
}
