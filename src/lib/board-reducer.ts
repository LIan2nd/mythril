import type { ChecklistItem, Issue } from "../domain/types";

export const THEME_KEY = "mythril-theme";
export const ACTIVE_PROJECT_KEY = "mythril-active-project";

export interface IssueFilters {
  mine: boolean;
  mineCode: string | null;
  urgent: boolean;
  query: string;
}

export function applyIssueFilters(issues: Issue[], f: IssueFilters): Issue[] {
  const q = f.query.trim().toLowerCase();
  return issues.filter((i) => {
    if (f.mine && f.mineCode && i.assignee.code !== f.mineCode) return false;
    if (f.urgent && !(i.priority === "HIGH" && i.type === "BUG")) return false;
    if (q && !(i.key.toLowerCase().includes(q) || i.title.toLowerCase().includes(q))) return false;
    return true;
  });
}

export type BoardAction =
  | { type: "SET_ISSUES"; issues: Issue[] }
  | { type: "MOVE"; issueId: number; status: string; beforeIssueId: number | null }
  | { type: "TOGGLE_ITEM"; issueId: number; itemId: number; done: boolean }
  | { type: "SET_ITEM"; issueId: number; item: ChecklistItem }
  | { type: "ADD_ITEM"; issueId: number; item: ChecklistItem }
  | { type: "SET_ISSUE"; issue: Issue }
  | { type: "CREATE"; issue: Issue }
  | { type: "RECONCILE_CREATE"; tempId: number; issue: Issue }
  | { type: "REMOVE"; issueId: number };

export function boardReducer(state: Issue[], action: BoardAction): Issue[] {
  switch (action.type) {
    case "SET_ISSUES":
      return action.issues;
    case "MOVE": {
      const target = state.find((i) => i.id === action.issueId);
      if (!target) return state;
      const before = action.beforeIssueId == null ? null : state.find((i) => i.id === action.beforeIssueId) ?? null;
      const colSiblings = state.filter((i) => i.status === action.status && i.id !== action.issueId);
      const maxPos = colSiblings.reduce((m, i) => Math.max(m, i.position), -1);
      const position = before && before.status === action.status ? before.position - 0.5 : maxPos + 1;
      return state.map((i) =>
        i.id === action.issueId ? { ...i, status: action.status, position } : i,
      );
    }
    case "TOGGLE_ITEM":
      return state.map((i) =>
        i.id !== action.issueId
          ? i
          : {
              ...i,
              checklist: i.checklist.map((c) => (c.id === action.itemId ? { ...c, done: action.done } : c)),
            },
      );
    case "SET_ITEM":
      return state.map((i) =>
        i.id !== action.issueId
          ? i
          : { ...i, checklist: i.checklist.map((c) => (c.id === action.item.id ? action.item : c)) },
      );
    case "ADD_ITEM":
      return state.map((i) =>
        i.id !== action.issueId
          ? i
          : { ...i, checklist: [...i.checklist, action.item] },
      );
    case "SET_ISSUE":
      return state.map((i) => (i.id === action.issue.id ? action.issue : i));
    case "CREATE":
      return [...state, action.issue];
    case "RECONCILE_CREATE":
      return state.map((i) => (i.id === action.tempId ? action.issue : i));
    case "REMOVE":
      return state.filter((i) => i.id !== action.issueId);
    default:
      return state;
  }
}
