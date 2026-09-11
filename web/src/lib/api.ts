import type {
  ApiResponse,
  Board,
  ChecklistItem,
  CreateIssuePayload,
  Issue,
  MoveIssuePayload,
  ProjectSummary,
  UpdateIssuePayload,
} from "../domain/types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json()) as ApiResponse<T>;
  if (!body.success || !res.ok) throw new Error(body.message || `Request failed: ${path}`);
  return body.data;
}

export const api = {
  getProjects: () => req<ProjectSummary[]>("/api/projects"),
  getBoard: (key: string) => req<Board>(`/api/projects/${encodeURIComponent(key)}/board`),
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
};
