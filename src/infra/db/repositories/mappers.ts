import type { AuthUser, ChecklistItem, Issue, IssueType, Priority, Role, User, UserStatus } from '@/domain/types';

export interface IssueRow {
  id: number;
  project_id: number;
  key: string;
  title: string;
  description: string;
  priority: string;
  type: string;
  status: string;
  position: number;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  user_code: string;
  user_name: string;
  user_avatar_color: string;
}

export interface ChecklistRow {
  id: number;
  issue_id: number;
  text: string;
  done: boolean;
  position: number;
}

export function rowToUser(row: IssueRow): User {
  return { code: row.user_code, name: row.user_name, avatarColor: row.user_avatar_color };
}

export function rowToChecklist(row: ChecklistRow): ChecklistItem {
  return { id: row.id, text: row.text, done: row.done, position: row.position };
}

function toIso(value: Date | string | null): string | undefined {
  if (value == null) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function rowToIssue(row: IssueRow, checklist: ChecklistItem[] = []): Issue {
  return {
    id: row.id,
    key: row.key,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    priority: row.priority as Priority,
    type: row.type as IssueType,
    status: row.status,
    assignee: rowToUser(row),
    position: Number(row.position),
    checklist: checklist.sort((a, b) => a.position - b.position),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export interface UserAuthRow {
  id: number;
  code: string;
  username: string | null;
  display_name: string | null;
  name: string;
  role: string;
  status: string;
  avatar_color: string;
  has_avatar: boolean | null;
}

/** Hydrate AuthUser from a legacy users row (code PK); display_name falls back to name. */
export function rowToAuthUser(row: UserAuthRow): AuthUser {
  return {
    id: Number(row.id),
    username: row.username ?? row.code.toLowerCase(),
    code: row.code ?? null,
    displayName: row.display_name ?? row.name,
    role: (row.role === 'admin' ? 'admin' : 'member') as Role,
    status: (row.status ?? 'active') as UserStatus,
    color: row.avatar_color,
    hasAvatar: Boolean(row.has_avatar),
  };
}
