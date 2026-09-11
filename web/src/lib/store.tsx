"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type {
  Board,
  ChecklistItem,
  ColumnId,
  CreateIssuePayload,
  Issue,
  ProjectSummary,
  UpdateIssuePayload,
} from "../domain/types";
import { api } from "./api";
import {
  applyIssueFilters,
  boardReducer,
  THEME_KEY,
  type IssueFilters,
} from "./board-reducer";

export type BoardPhase = "loading" | "ready" | "error";

interface BoardStore {
  projects: ProjectSummary[];
  projectKey: string | null;
  board: Board | null;
  issues: Issue[];
  visibleIssues: Issue[];
  shown: number;
  total: number;
  phase: BoardPhase;
  switching: boolean;
  loadError: string | null;
  toast: string | null;
  dialogOpen: boolean;
  filters: IssueFilters;
  dark: boolean;
  setFilters: (f: IssueFilters) => void;
  toggleDark: () => void;
  setDialogOpen: (open: boolean) => void;
  dismissToast: () => void;
  selectProject: (key: string) => Promise<void>;
  retry: () => void;
  toggleChecklist: (issueId: number, itemId: number) => Promise<void>;
  moveIssue: (issueId: number, status: ColumnId, beforeIssueId: number | null) => Promise<void>;
  createIssue: (payload: CreateIssuePayload) => Promise<void>;
  updateIssue: (id: number, payload: UpdateIssuePayload) => Promise<void>;
  deleteIssue: (id: number) => Promise<void>;
}

const BoardContext = createContext<BoardStore | null>(null);

export function useBoard(): BoardStore {
  const store = useContext(BoardContext);
  if (!store) throw new Error("useBoard must be used inside BoardProvider");
  return store;
}

function failMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [issues, dispatch] = useReducer(boardReducer, []);
  const [phase, setPhase] = useState<BoardPhase>("loading");
  const [switching, setSwitching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filters, setFilters] = useState<IssueFilters>({ mine: false, urgent: false, query: "" });
  const [dark, setDark] = useState(false);
  const tempId = useRef(-1);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usersRef = useRef(board?.users ?? []);
  usersRef.current = board?.users ?? [];

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const loadBoard = useCallback(async (key: string) => {
    const data = await api.getBoard(key);
    setBoard(data);
    setProjectKey(data.project.key);
    dispatch({ type: "SET_ISSUES", issues: data.issues });
  }, []);

  const boot = useCallback(async () => {
    setPhase("loading");
    setLoadError(null);
    try {
      const list = await api.getProjects();
      setProjects(list);
      const first = list[0];
      if (!first) throw new Error("No projects available");
      await loadBoard(first.key);
      setPhase("ready");
    } catch (err) {
      setLoadError(failMessage(err, "Failed to load board"));
      setPhase("error");
    }
  }, [loadBoard]);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      const isDark =
        saved === "dark" || (saved == null && document.documentElement.dataset.theme === "dark");
      setDark(isDark);
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
    } catch {
      setDark(document.documentElement.dataset.theme === "dark");
    }
  }, []);

  const toggleDark = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.dataset.theme = next ? "dark" : "light";
      try {
        localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  const selectProject = useCallback(
    async (key: string) => {
      if (key === projectKey) return;
      setSwitching(true);
      try {
        await loadBoard(key);
      } catch (err) {
        flashToast(failMessage(err, `Failed to load ${key}`));
      } finally {
        setSwitching(false);
      }
    },
    [loadBoard, projectKey, flashToast],
  );

  const retry = useCallback(() => {
    void boot();
  }, [boot]);

  const toggleChecklist = useCallback(
    async (issueId: number, itemId: number) => {
      const issue = issues.find((i) => i.id === issueId);
      const item = issue?.checklist.find((c) => c.id === itemId);
      if (!issue || !item) return;
      const done = !item.done;
      dispatch({ type: "TOGGLE_ITEM", issueId, itemId, done });
      try {
        const updated: ChecklistItem = await api.toggleChecklistItem(itemId, done);
        dispatch({ type: "SET_ITEM", issueId, item: updated });
      } catch (err) {
        dispatch({ type: "TOGGLE_ITEM", issueId, itemId, done: item.done });
        flashToast(failMessage(err, "Checklist update failed"));
      }
    },
    [issues, flashToast],
  );

  const moveIssue = useCallback(
    async (issueId: number, status: ColumnId, beforeIssueId: number | null) => {
      const prev = issues;
      dispatch({ type: "MOVE", issueId, status, beforeIssueId });
      try {
        const data = await api.moveIssue(issueId, { status, beforeIssueId });
        dispatch({ type: "SET_ISSUES", issues: data.issues });
      } catch (err) {
        dispatch({ type: "SET_ISSUES", issues: prev });
        flashToast(failMessage(err, "Move failed"));
      }
    },
    [issues, flashToast],
  );

  const createIssue = useCallback(
    async (payload: CreateIssuePayload) => {
      const id = tempId.current;
      tempId.current -= 1;
      const users = usersRef.current;
      const assignee =
        users.find((u) => u.code === payload.assignee) ??
        ({ code: payload.assignee, name: payload.assignee, avatarColor: "yellow" } as Issue["assignee"]);
      const siblings = issues.filter((i) => i.status === payload.status);
      const position = siblings.reduce((m, i) => Math.max(m, i.position), -1) + 1;
      const optimistic: Issue = {
        id,
        key: "···",
        projectId: board?.project.id ?? 0,
        title: payload.title,
        description: payload.description ?? "",
        priority: payload.priority,
        type: payload.type,
        status: payload.status,
        assignee,
        position,
        checklist: (payload.checklistTexts ?? []).map((text, idx) => ({
          id: id * 100 - idx,
          text,
          done: false,
          position: idx,
        })),
      };
      dispatch({ type: "CREATE", issue: optimistic });
      try {
        const created = await api.createIssue(projectKey ?? "", payload);
        dispatch({ type: "RECONCILE_CREATE", tempId: id, issue: created });
      } catch (err) {
        dispatch({ type: "REMOVE", issueId: id });
        flashToast(failMessage(err, "Create failed"));
      }
    },
    [board, issues, projectKey, flashToast],
  );

  const updateIssue = useCallback(
    async (id: number, payload: UpdateIssuePayload) => {
      const prev = issues.find((i) => i.id === id);
      if (!prev) return;
      const users = usersRef.current;
      const merged: Issue = {
        ...prev,
        ...payload,
        status: payload.status ?? prev.status,
        assignee: payload.assignee
          ? (users.find((u) => u.code === payload.assignee) ?? prev.assignee)
          : prev.assignee,
      };
      dispatch({ type: "SET_ISSUE", issue: merged });
      try {
        const updated = await api.updateIssue(id, payload);
        dispatch({ type: "SET_ISSUE", issue: updated });
      } catch (err) {
        dispatch({ type: "SET_ISSUE", issue: prev });
        flashToast(failMessage(err, "Update failed"));
      }
    },
    [issues, flashToast],
  );

  const deleteIssue = useCallback(
    async (id: number) => {
      const prev = issues;
      dispatch({ type: "REMOVE", issueId: id });
      try {
        await api.deleteIssue(id);
      } catch (err) {
        dispatch({ type: "SET_ISSUES", issues: prev });
        flashToast(failMessage(err, "Delete failed"));
      }
    },
    [issues, flashToast],
  );

  const visibleIssues = useMemo(() => applyIssueFilters(issues, filters), [issues, filters]);

  const value: BoardStore = {
    projects,
    projectKey,
    board,
    issues,
    visibleIssues,
    shown: visibleIssues.length,
    total: issues.length,
    phase,
    switching,
    loadError,
    toast,
    dialogOpen,
    filters,
    dark,
    setFilters,
    toggleDark,
    setDialogOpen,
    dismissToast,
    selectProject,
    retry,
    toggleChecklist,
    moveIssue,
    createIssue,
    updateIssue,
    deleteIssue,
  };

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}
