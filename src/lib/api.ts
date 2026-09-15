import type {
  AdminCreateUserPayload,
  AdminProjectDetail,
  AdminProjectPayload,
  AdminUpdateUserPayload,
  AdminUserDetail,
  ApiResponse,
  AuthUser,
  Board,
  BoardColumn,
  ChecklistItem,
  ColumnKind,
  CreateColumnPayload,
  CreateIssuePayload,
  Issue,
  LoginPayload,
  MoveIssuePayload,
  PasswordChangePayload,
  ProfileUpdatePayload,
  ProjectMembersPayload,
  ProjectSummary,
  RegisterRequestPayload,
  ReorderColumnsPayload,
  Role,
  Sprint,
  UpdateColumnPayload,
  UpdateIssuePayload,
  UserStatus,
} from "../domain/types";
import type { UpsertSprintInput } from "../domain/repositories";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ReqOpts {
  noRedirect?: boolean;
}

async function req<T>(path: string, init?: RequestInit, opts?: ReqOpts): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const res = await fetch(path, {
    ...init,
    headers: { ...(isForm ? {} : { "Content-Type": "application/json" }), ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    body = null;
  }
  if (!res.ok || !body || !body.success) {
    const message = body?.message || `Request failed: ${path}`;
    if (res.status === 401 && !opts?.noRedirect && typeof window !== "undefined") {
      const p = window.location.pathname;
      if (p !== "/login" && p !== "/register") window.location.href = "/login";
    }
    throw new ApiError(res.status, message);
  }
  return body.data;
}

export function avatarSrc(code: string | null | undefined, ts?: number): string {
  if (!code) return "";
  return `/api/users/${encodeURIComponent(code)}/avatar${ts ? `?ts=${ts}` : ""}`;
}

export const api = {
  getProjects: () => req<ProjectSummary[]>("/api/projects"),
  getBoard: (key: string) => req<Board>(`/api/projects/${encodeURIComponent(key)}/board`),
  updateSprint: (key: string, payload: UpsertSprintInput) =>
    req<Sprint>(`/api/projects/${encodeURIComponent(key)}/sprint`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  createIssue: (key: string, payload: CreateIssuePayload) =>
    req<Issue>(`/api/projects/${encodeURIComponent(key)}/issues`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateIssue: (id: number, payload: UpdateIssuePayload) =>
    req<Issue>(`/api/issues/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  moveIssue: (id: number, payload: MoveIssuePayload) =>
    req<{ issues: Issue[] }>(`/api/issues/${id}/move`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  addChecklistItem: (issueId: number, text: string) =>
    req<ChecklistItem>(`/api/issues/${issueId}/checklist`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  toggleChecklistItem: (itemId: number, done: boolean) =>
    req<ChecklistItem>(`/api/checklist-items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ done }),
    }),
  deleteIssue: (id: number) => req<unknown>(`/api/issues/${id}`, { method: "DELETE" }),

  auth: {
    login: (payload: LoginPayload) =>
      req<{ user: AuthUser }>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
    register: (payload: RegisterRequestPayload) =>
      req<{ user: AuthUser }>(
        "/api/auth/register",
        { method: "POST", body: JSON.stringify(payload) },
        { noRedirect: true },
      ),
    logout: () => req<unknown>("/api/auth/logout", { method: "POST" }, { noRedirect: true }),
    me: (opts?: ReqOpts) => req<{ user: AuthUser }>("/api/auth/me", undefined, opts),
  },

  profile: {
    update: (payload: ProfileUpdatePayload) =>
      req<{ user: AuthUser }>("/api/auth/profile", { method: "PATCH", body: JSON.stringify(payload) }),
    password: (payload: PasswordChangePayload) =>
      req<unknown>("/api/auth/password", { method: "PUT", body: JSON.stringify(payload) }),
    avatar: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return req<{ user: AuthUser }>("/api/auth/avatar", { method: "PUT", body: form });
    },
    removeAvatar: () => req<unknown>("/api/auth/avatar", { method: "DELETE" }),
  },

  admin: {
    listUsers: (status?: UserStatus) =>
      req<AdminUserDetail[]>(`/api/admin/users${status ? `?status=${status}` : ""}`),
    createUser: (payload: AdminCreateUserPayload) =>
      req<AuthUser>("/api/admin/users", { method: "POST", body: JSON.stringify(payload) }),
    updateUser: (id: number, payload: AdminUpdateUserPayload) =>
      req<AuthUser>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    deleteUser: (id: number) => req<unknown>(`/api/admin/users/${id}`, { method: "DELETE" }),
    listProjects: () => req<AdminProjectDetail[]>("/api/admin/projects"),
    createProject: (payload: AdminProjectPayload) =>
      req<AdminProjectDetail>("/api/admin/projects", { method: "POST", body: JSON.stringify(payload) }),
    updateProject: (key: string, payload: Partial<AdminProjectPayload>) =>
      req<AdminProjectDetail>(`/api/admin/projects/${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    deleteProject: (key: string, cascade = false) =>
      req<unknown>(`/api/admin/projects/${encodeURIComponent(key)}${cascade ? '?cascade=true' : ''}`, { method: "DELETE" }),
    setMembers: (key: string, payload: ProjectMembersPayload) =>
      req<AdminProjectDetail>(`/api/admin/projects/${encodeURIComponent(key)}/members`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    listColumns: (projectKey: string) =>
      req<BoardColumn[]>(`/api/admin/projects/${encodeURIComponent(projectKey)}/columns`),
    createColumn: (projectKey: string, payload: CreateColumnPayload) =>
      req<BoardColumn>(`/api/admin/projects/${encodeURIComponent(projectKey)}/columns`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateColumn: (projectKey: string, key: string, payload: UpdateColumnPayload) =>
      req<BoardColumn>(`/api/admin/projects/${encodeURIComponent(projectKey)}/columns/${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    reorderColumns: (projectKey: string, payload: ReorderColumnsPayload) =>
      req<BoardColumn[]>(`/api/admin/projects/${encodeURIComponent(projectKey)}/columns/reorder`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    deleteColumn: (projectKey: string, key: string) =>
      req<unknown>(`/api/admin/projects/${encodeURIComponent(projectKey)}/columns/${encodeURIComponent(key)}`, {
        method: "DELETE",
      }),
  },
};

export type { ColumnKind, Role };
