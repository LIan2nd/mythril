import type { ChecklistItem, ColumnId, Issue, IssueType, Priority, User } from '@/domain/types';

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
    status: row.status as ColumnId,
    assignee: rowToUser(row),
    position: Number(row.position),
    checklist: checklist.sort((a, b) => a.position - b.position),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
