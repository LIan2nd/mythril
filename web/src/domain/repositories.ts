import type {
  ChecklistItem,
  ColumnId,
  CreateIssuePayload,
  Issue,
  Project,
  Sprint,
  UpdateIssuePayload,
  User,
} from './types';

export interface CreateIssueInput extends CreateIssuePayload {
  projectId: number;
}

export type UpdateIssueInput = UpdateIssuePayload;

export interface ProjectRepo {
  list(): Promise<Project[]>;
  getByKey(key: string): Promise<Project | null>;
}

export interface SprintRepo {
  getActiveForProject(projectId: number): Promise<Sprint | null>;
}

export interface UserRepo {
  list(): Promise<User[]>;
  getByCode(code: string): Promise<User | null>;
}

export interface IssueRepo {
  /** Hydrated with assignee User and checklist items ordered by position. */
  listByProject(projectId: number): Promise<Issue[]>;
  getById(id: number): Promise<Issue | null>;
  create(input: CreateIssueInput): Promise<Issue>;
  update(id: number, patch: UpdateIssuePayload): Promise<Issue>;
  remove(id: number): Promise<void>;
  /** Reposition within/at end of column; target column fully renumbered. */
  move(id: number, status: ColumnId, beforeIssueId: number | null): Promise<void>;
  /** 'MY-<n>' where n = max numeric suffix across ALL projects + 1 (global seq, export behavior). */
  generateKey(projectKey: string): Promise<string>;
}

export interface ChecklistRepo {
  /** Append a new (undone) item to an issue. Max-5 cap is enforced in the service layer. */
  add(issueId: number, text: string): Promise<ChecklistItem>;
  toggle(id: number, done: boolean): Promise<ChecklistItem>;
  listByIssue(issueId: number): Promise<ChecklistItem[]>;
}
