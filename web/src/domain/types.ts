// Shared domain contract — imported verbatim by UI and API layers (owned by orchestrator).

export const PRIORITIES = ['HIGH', 'MED', 'LOW'] as const;
export const ISSUE_TYPES = ['BUG', 'TASK'] as const;
export const COLUMN_IDS = ['todo', 'progress', 'review', 'shipped'] as const;

export type Priority = (typeof PRIORITIES)[number];
export type IssueType = (typeof ISSUE_TYPES)[number];
export type ColumnId = (typeof COLUMN_IDS)[number];

export interface User {
  code: string;
  name: string;
  avatarColor: string;
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
  status: ColumnId;
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

export interface Board {
  project: Project;
  sprint: Sprint | null;
  users: User[];
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
  status: ColumnId;
  assignee: string;
  checklistTexts?: string[]; // max 5, server rejects beyond
}

export interface UpdateIssuePayload {
  title?: string;
  description?: string;
  priority?: Priority;
  type?: IssueType;
  assignee?: string;
  status?: ColumnId;
}

export interface MoveIssuePayload {
  status: ColumnId;
  beforeIssueId: number | null; // null = append to end
}

export interface UpsertChecklistPayload {
  text?: string;
  done?: boolean;
}

export const COLUMN_LABELS: Record<ColumnId, string> = {
  todo: 'To Do',
  progress: 'In Progress',
  review: 'Code Review',
  shipped: 'Shipped',
};

export function columnIndexOf(col: ColumnId): number {
  return COLUMN_IDS.indexOf(col);
}

export function sortIssuesForBoard(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) =>
    columnIndexOf(a.status) - columnIndexOf(b.status) || a.position - b.position || a.id - b.id,
  );
}

export interface SprintStats {
  total: number;
  done: number;
  open: number;
  highBugs: number;
  inReview: number;
  shippedByColumn: Record<ColumnId, number>;
  pct: number;
}

export function computeSprintStats(issues: Issue[]): SprintStats {
  const shippedByColumn: Record<ColumnId, number> = { todo: 0, progress: 0, review: 0, shipped: 0 };
  for (const i of issues) shippedByColumn[i.status] += 1;
  const total = issues.length;
  const done = shippedByColumn.shipped;
  return {
    total,
    done,
    open: total - done,
    highBugs: issues.filter((i) => i.priority === 'HIGH' && i.type === 'BUG' && i.status !== 'shipped').length,
    inReview: shippedByColumn.review,
    shippedByColumn,
    pct: total ? Math.round((done / total) * 100) : 0,
  };
}
