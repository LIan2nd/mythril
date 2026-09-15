import type {
  AuthUser,
  BoardColumn,
  ChecklistItem,
  ColumnColor,
  ColumnKind,
  CreateIssuePayload,
  Issue,
  Project,
  Role,
  Sprint,
  UpdateIssuePayload,
  User,
  UserStatus,
} from './types';

export interface CreateIssueInput extends CreateIssuePayload {
  projectId: number;
}

export type UpdateIssueInput = UpdateIssuePayload;

export interface NewUserInput {
  code: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  color: string;
}

export interface UserProfilePatch {
  username?: string;
  displayName?: string;
  color?: string;
}

export interface AdminUserPatch {
  role?: Role;
  status?: UserStatus;
  displayName?: string;
  color?: string;
  code?: string;
  passwordHash?: string;
}

export interface AuthRecord {
  user: AuthUser;
  passwordHash: string | null;
}

export interface ProjectRepo {
  list(): Promise<Project[]>;
  getByKey(key: string): Promise<Project | null>;
  getById(id: number): Promise<Project | null>;
  create(input: { key: string; name: string }): Promise<Project>;
  update(id: number, patch: { key?: string; name?: string }): Promise<Project>;
  remove(id: number): Promise<void>;
  countIssues(projectId: number): Promise<number>;
  /** Projects where the user is a member (no admin shortcut — callers handle role). */
  listForUser(userCode: string): Promise<Project[]>;
  memberCodes(projectId: number): Promise<string[]>;
  isMember(projectId: number, userCode: string): Promise<boolean>;
  setMembers(projectId: number, codes: string[]): Promise<void>;
}

export interface UpsertSprintInput {
  number: number;
  title?: string;
  kicker?: string;
  startsAt: string;
  endsAt: string;
  isActive?: boolean;
}

export interface SprintRepo {
  getActiveForProject(projectId: number): Promise<Sprint | null>;
  upsertActiveForProject(projectId: number, input: UpsertSprintInput): Promise<Sprint>;
}

export interface UserRepo {
  list(): Promise<User[]>;
  getByCode(code: string): Promise<User | null>;
  /** Every user as AuthUser (all statuses), ordered by code. */
  listAuth(): Promise<AuthUser[]>;
  listAuthByCodes(codes: string[]): Promise<AuthUser[]>;
  getAuthByUsername(username: string): Promise<AuthUser | null>;
  create(input: NewUserInput): Promise<AuthUser>;
  updateProfile(id: number, patch: UserProfilePatch): Promise<AuthUser>;
  adminPatch(id: number, patch: AdminUserPatch): Promise<AuthUser>;
  updatePassword(id: number, passwordHash: string): Promise<void>;
  setAvatar(id: number, avatar: Uint8Array | null, avatarType: string | null): Promise<AuthUser>;
  getAvatarByCode(code: string): Promise<{ data: Uint8Array; type: string; updatedAt: string | null } | null>;
  remove(id: number): Promise<void>;
}

export interface AuthRepo {
  getRecordForLogin(username: string): Promise<AuthRecord | null>;
  getUserById(id: number): Promise<AuthUser | null>;
}

export interface BoardColumnRepo {
  list(projectId: number): Promise<BoardColumn[]>;
  getByKey(projectId: number, key: string): Promise<BoardColumn | null>;
  /** Inserts at beforeKey's position (shifting following columns) or appends when null. */
  create(
    projectId: number,
    input: {
      key: string;
      label: string;
      kind: ColumnKind;
      color: ColumnColor;
      beforeKey: string | null;
    },
  ): Promise<BoardColumn>;
  update(
    projectId: number,
    key: string,
    patch: { label?: string; kind?: ColumnKind; color?: ColumnColor },
  ): Promise<BoardColumn>;
  reorder(projectId: number, orderedKeys: string[]): Promise<BoardColumn[]>;
  remove(projectId: number, key: string): Promise<void>;
}

export interface IssueRepo {
  /** Hydrated with assignee User and checklist items ordered by position. */
  listByProject(projectId: number): Promise<Issue[]>;
  getById(id: number): Promise<Issue | null>;
  create(input: CreateIssueInput): Promise<Issue>;
  update(id: number, patch: UpdateIssuePayload): Promise<Issue>;
  remove(id: number): Promise<void>;
  /** Reposition within/at end of column; target column fully renumbered. */
  move(id: number, status: string, beforeIssueId: number | null): Promise<void>;
  /** 'MY-<n>' where n = max numeric suffix across ALL projects + 1 (global seq, export behavior). */
  generateKey(projectKey: string): Promise<string>;
  countByStatus(status: string): Promise<number>;
  countByProjectAndStatus(projectId: number, status: string): Promise<number>;
  countByAssignee(userCode: string): Promise<number>;
  reassign(projectId: number, fromCodes: string[], toCode: string): Promise<number>;
}

export interface ChecklistRepo {
  /** Append a new (undone) item to an issue. Max-5 cap is enforced in the service layer. */
  add(issueId: number, text: string): Promise<ChecklistItem>;
  toggle(id: number, done: boolean): Promise<ChecklistItem>;
  listByIssue(issueId: number): Promise<ChecklistItem[]>;
  getIssueId(id: number): Promise<number | null>;
}
