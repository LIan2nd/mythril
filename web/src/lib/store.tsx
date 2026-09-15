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
  AuthUser,
  Board,
  BoardColumn,
  ChecklistItem,
  CreateColumnPayload,
  CreateIssuePayload,
  Issue,
  ProjectSummary,
  UpdateColumnPayload,
  UpdateIssuePayload,
} from "../domain/types";
import type { UpsertSprintInput } from "../domain/repositories";
import { ApiError, api } from "./api";
import { sanitizeNext } from "./sanitize-next";
import {
  applyIssueFilters,
  boardReducer,
  THEME_KEY,
  ACTIVE_PROJECT_KEY,
  type IssueFilters,
} from "./board-reducer";

export type BoardPhase = "loading" | "ready" | "error" | "session";
export type SessionPhase = "loading" | "ready" | "anon";

export type SessionStatus = "loading" | "authed" | "anon";

interface AuthActions {
  login: (username: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export type ToastType = "success" | "error" | "info";

export interface ToastState {
  id: number;
  message: string;
  type: ToastType;
  title?: string;
}

interface BoardStore extends AuthActions {
  sessionStatus: SessionStatus;
  sessionPhase: SessionPhase;
  user: AuthUser | null;
  columns: BoardColumn[];
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
  forbidden: boolean;
  toast: ToastState | null;
  dialogOpen: boolean;
  sprintDialogOpen: boolean;
  deleteTargetIssue: Issue | null;
  editingIssue: Issue | null;
  filters: IssueFilters;
  dark: boolean;
  setFilters: (f: IssueFilters) => void;
  toggleDark: () => void;
  setDialogOpen: (open: boolean) => void;
  setSprintDialogOpen: (open: boolean) => void;
  setDeleteTargetIssue: (issue: Issue | null) => void;
  setEditingIssue: (issue: Issue | null) => void;
  showToast: (message: string, type?: ToastType, title?: string) => void;
  dismissToast: () => void;
  selectProject: (key: string) => Promise<void>;
  retry: () => void;
  toggleChecklist: (issueId: number, itemId: number) => Promise<void>;
  addChecklistItem: (issueId: number, text: string) => Promise<void>;
  moveIssue: (issueId: number, status: string, beforeIssueId: number | null) => Promise<void>;
  createIssue: (payload: CreateIssuePayload) => Promise<void>;
  updateIssue: (id: number, payload: UpdateIssuePayload) => Promise<void>;
  updateSprint: (payload: UpsertSprintInput) => Promise<void>;
  deleteIssue: (id: number) => Promise<void>;
  refreshProjects: (preferredKey?: string | null) => Promise<void>;
  addColumnOpen: boolean;
  setAddColumnOpen: (open: boolean) => void;
  editingColumn: BoardColumn | null;
  setEditingColumn: (col: BoardColumn | null) => void;
  reorderColumns: (orderedKeys: string[]) => Promise<void>;
  createColumn: (payload: CreateColumnPayload) => Promise<void>;
  updateColumn: (key: string, payload: UpdateColumnPayload) => Promise<void>;
  deleteColumn: (key: string) => Promise<void>;
}

const BoardContext = createContext<BoardStore | null>(null);

export function useBoard(): BoardStore {
  const store = useContext(BoardContext);
  if (!store) throw new Error("useBoard must be used inside BoardProvider");
  return store;
}

export function useSession(): Pick<BoardStore, "user" | "sessionStatus" | "login" | "logout" | "refreshSession"> {
  const store = useBoard();
  return {
    user: store.user,
    sessionStatus: store.sessionStatus,
    login: store.login,
    logout: store.logout,
    refreshSession: store.refreshSession,
  };
}

function failMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("loading");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [issues, dispatch] = useReducer(boardReducer, []);
  const [phase, setPhase] = useState<BoardPhase>("session");
  const [switching, setSwitching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const toastIdRef = useRef(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sprintDialogOpen, setSprintDialogOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<BoardColumn | null>(null);
  const [deleteTargetIssue, setDeleteTargetIssue] = useState<Issue | null>(null);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [filters, setFilters] = useState<IssueFilters>({ mine: false, mineCode: null, urgent: false, query: "" });
  const [dark, setDark] = useState(false);
  const tempId = useRef(-1);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usersRef = useRef(board?.users ?? []);
  usersRef.current = board?.users ?? [];

  const columns = useMemo<BoardColumn[]>(() => board?.columns ?? [], [board]);

  const showToast = useCallback((msg: string, type: ToastType = "info", title?: string) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, message: msg, type, title });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const flashToast = useCallback(
    (msg: string, type: ToastType = "error", title?: string) => {
      showToast(msg, type, title);
    },
    [showToast],
  );

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const loadBoard = useCallback(async (key: string) => {
    const data = await api.getBoard(key);
    setBoard(data);
    setProjectKey(data.project.key);
    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, data.project.key);
    } catch {
      // ignore
    }
    dispatch({ type: "SET_ISSUES", issues: data.issues });
  }, []);

  const loadProjects = useCallback(async () => {
    setPhase("loading");
    setLoadError(null);
    setForbidden(false);
    try {
      const list = await api.getProjects();
      setProjects(list);
      if (list.length === 0) {
        setPhase("ready");
        return;
      }
      let savedKey: string | null = null;
      try {
        savedKey = localStorage.getItem(ACTIVE_PROJECT_KEY);
      } catch {
        savedKey = null;
      }
      const match = savedKey ? list.find((p) => p.key === savedKey) : null;
      const initial = match ?? list[0];
      await loadBoard(initial.key);
      setPhase("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setPhase("ready");
        return;
      }
      setLoadError(failMessage(err, "Failed to load board"));
      setPhase("error");
    }
  }, [loadBoard]);

  const refreshProjects = useCallback(
    async (preferredKey?: string | null) => {
      try {
        const list = await api.getProjects();
        setProjects(list);
        let savedKey: string | null = null;
        try {
          savedKey = localStorage.getItem(ACTIVE_PROJECT_KEY);
        } catch {
          savedKey = null;
        }
        const targetKey = preferredKey ?? projectKey ?? savedKey;
        const exists = list.some((p) => p.key === targetKey);
        if (exists && targetKey) {
          if (targetKey !== projectKey) {
            await loadBoard(targetKey);
          }
        } else if (list.length > 0) {
          await loadBoard(list[0].key);
        } else {
          setBoard(null);
          setProjectKey(null);
          try {
            localStorage.removeItem(ACTIVE_PROJECT_KEY);
          } catch {
            // ignore
          }
          dispatch({ type: "SET_ISSUES", issues: [] });
        }
      } catch (err) {
        console.error("Failed to refresh projects", err);
      }
    },
    [projectKey, loadBoard],
  );

  const refreshSession = useCallback(async () => {
    try {
      const data = await api.auth.me({ noRedirect: true });
      setUser(data.user);
      setSessionStatus("authed");
      setFilters((f) => ({ ...f, mineCode: data.user.code }));
    } catch {
      setUser(null);
      setSessionStatus("anon");
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (sessionStatus === "authed") {
      void loadProjects();
    } else if (sessionStatus === "anon") {
      if (typeof window !== "undefined") {
        const p = window.location.pathname;
        if (p !== "/login" && p !== "/register") {
          const next = sanitizeNext(window.location.pathname + window.location.search);
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
        }
      }
    }
  }, [sessionStatus, loadProjects]);

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
        return next;
      }
      return next;
    });
  }, []);

  const login = useCallback(
    async (username: string, password: string, rememberMe: boolean) => {
      const data = await api.auth.login({ username, password, rememberMe });
      setUser(data.user);
      setSessionStatus("authed");
      setFilters((f) => ({ ...f, mineCode: data.user.code }));
      await loadProjects();
    },
    [loadProjects],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      setUser(null);
    }
    setUser(null);
    setSessionStatus("anon");
    setBoard(null);
    setProjects([]);
    setProjectKey(null);
    try {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    } catch {
      // ignore
    }
    dispatch({ type: "SET_ISSUES", issues: [] });
    window.location.href = "/login";
  }, []);

  const selectProject = useCallback(
    async (key: string) => {
      if (key === projectKey) return;
      setSwitching(true);
      try {
        await loadBoard(key);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
        } else {
          flashToast(failMessage(err, `Failed to load ${key}`));
        }
      } finally {
        setSwitching(false);
      }
    },
    [loadBoard, projectKey, flashToast],
  );

  const retry = useCallback(() => {
    void loadProjects();
  }, [loadProjects]);

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

  const addChecklistItem = useCallback(
    async (issueId: number, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      try {
        const item = await api.addChecklistItem(issueId, trimmed);
        dispatch({ type: "ADD_ITEM", issueId, item });
        showToast("Checklist item added", "success");
      } catch (err) {
        flashToast(failMessage(err, "Failed to add checklist item"));
        throw err;
      }
    },
    [flashToast, showToast],
  );

  const moveIssue = useCallback(
    async (issueId: number, status: string, beforeIssueId: number | null) => {
      const prev = issues;
      dispatch({ type: "MOVE", issueId, status, beforeIssueId });
      try {
        const data = await api.moveIssue(issueId, { status, beforeIssueId });
        dispatch({ type: "SET_ISSUES", issues: data.issues });
        showToast("Issue moved successfully", "success");
      } catch (err) {
        dispatch({ type: "SET_ISSUES", issues: prev });
        flashToast(failMessage(err, "Move failed"));
      }
    },
    [issues, flashToast, showToast],
  );

  const createIssue = useCallback(
    async (payload: CreateIssuePayload) => {
      const id = tempId.current;
      tempId.current -= 1;
      const users = usersRef.current;
      const assigneeCode = payload.assignee;
      const rosterHit = users.find((u) => u.code === assigneeCode);
      const assignee: Issue["assignee"] = rosterHit
        ? { code: rosterHit.code ?? assigneeCode, name: rosterHit.displayName, avatarColor: rosterHit.color }
        : ({ code: assigneeCode, name: assigneeCode, avatarColor: "yellow" } as Issue["assignee"]);
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
        showToast("Issue created successfully", "success");
      } catch (err) {
        dispatch({ type: "REMOVE", issueId: id });
        flashToast(failMessage(err, "Create failed"));
        throw err;
      }
    },
    [board, issues, projectKey, flashToast, showToast],
  );

  const updateIssue = useCallback(
    async (id: number, payload: UpdateIssuePayload) => {
      const prev = issues.find((i) => i.id === id);
      if (!prev) return;
      const users = usersRef.current;
      const rosterHit = payload.assignee ? users.find((u) => u.code === payload.assignee) : undefined;
      const merged: Issue = {
        ...prev,
        ...payload,
        status: payload.status ?? prev.status,
        assignee: payload.assignee
          ? rosterHit
            ? { code: rosterHit.code ?? payload.assignee, name: rosterHit.displayName, avatarColor: rosterHit.color }
            : prev.assignee
          : prev.assignee,
      };
      dispatch({ type: "SET_ISSUE", issue: merged });
      try {
        const updated = await api.updateIssue(id, payload);
        dispatch({ type: "SET_ISSUE", issue: updated });
        showToast("Issue updated successfully", "success");
      } catch (err) {
        dispatch({ type: "SET_ISSUE", issue: prev });
        flashToast(failMessage(err, "Update failed"));
        throw err;
      }
    },
    [issues, flashToast, showToast],
  );

  const deleteIssue = useCallback(
    async (id: number) => {
      const prev = issues;
      dispatch({ type: "REMOVE", issueId: id });
      try {
        await api.deleteIssue(id);
        showToast("Issue deleted successfully", "success");
      } catch (err) {
        dispatch({ type: "SET_ISSUES", issues: prev });
        flashToast(failMessage(err, "Delete failed"));
        throw err;
      }
    },
    [issues, flashToast, showToast],
  );

  const updateSprint = useCallback(
    async (payload: UpsertSprintInput) => {
      if (!projectKey) return;
      try {
        const updated = await api.updateSprint(projectKey, payload);
        setBoard((prev) => (prev ? { ...prev, sprint: updated } : null));
        setProjects((prev) =>
          prev.map((p) =>
            p.key === projectKey
              ? {
                  ...p,
                  activeSprint: {
                    number: updated.number,
                    kicker: updated.kicker,
                    title: updated.title,
                    daysLeft: updated.daysLeft,
                  },
                }
              : p,
          ),
        );
        showToast("Sprint updated successfully", "success");
        setSprintDialogOpen(false);
      } catch (err) {
        flashToast(failMessage(err, "Failed to update sprint"));
        throw err;
      }
    },
    [projectKey, flashToast, showToast],
  );

  const reorderColumns = useCallback(
    async (orderedKeys: string[]) => {
      if (!projectKey || !board) return;
      const prev = board.columns;
      const keyMap = new Map(prev.map((c) => [c.key, c]));
      const next: BoardColumn[] = [];
      for (const k of orderedKeys) {
        const c = keyMap.get(k);
        if (c) next.push({ ...c, position: next.length });
      }
      setBoard((b) => (b ? { ...b, columns: next } : b));
      try {
        const saved = await api.admin.reorderColumns(projectKey, { orderedKeys });
        setBoard((b) => (b ? { ...b, columns: saved } : b));
        showToast("Columns reordered successfully", "success");
      } catch (err) {
        setBoard((b) => (b ? { ...b, columns: prev } : b));
        flashToast(failMessage(err, "Failed to reorder columns"));
        throw err;
      }
    },
    [projectKey, board, showToast, flashToast],
  );

  const createColumn = useCallback(
    async (payload: CreateColumnPayload) => {
      if (!projectKey) return;
      try {
        const col = await api.admin.createColumn(projectKey, payload);
        setBoard((b) => (b ? { ...b, columns: [...b.columns, col] } : b));
        showToast(`Column "${col.label}" created`, "success");
      } catch (err) {
        flashToast(failMessage(err, "Failed to create column"));
        throw err;
      }
    },
    [projectKey, showToast, flashToast],
  );

  const updateColumn = useCallback(
    async (key: string, payload: UpdateColumnPayload) => {
      if (!projectKey) return;
      try {
        const updated = await api.admin.updateColumn(projectKey, key, payload);
        setBoard((b) =>
          b
            ? {
                ...b,
                columns: b.columns.map((c) => (c.key === key ? updated : c)),
              }
            : b,
        );
        showToast("Column updated successfully", "success");
      } catch (err) {
        flashToast(failMessage(err, "Failed to update column"));
        throw err;
      }
    },
    [projectKey, showToast, flashToast],
  );

  const deleteColumn = useCallback(
    async (key: string) => {
      if (!projectKey) return;
      try {
        await api.admin.deleteColumn(projectKey, key);
        setBoard((b) =>
          b
            ? {
                ...b,
                columns: b.columns.filter((c) => c.key !== key),
              }
            : b,
        );
        showToast("Column deleted", "success");
      } catch (err) {
        flashToast(failMessage(err, "Failed to delete column"));
        throw err;
      }
    },
    [projectKey, showToast, flashToast],
  );

  const visibleIssues = useMemo(() => applyIssueFilters(issues, filters), [issues, filters]);
  const sessionPhase: SessionPhase = sessionStatus === "loading" ? "loading" : sessionStatus === "authed" ? "ready" : "ready";

  const value: BoardStore = {
    sessionStatus,
    sessionPhase,
    user,
    columns,
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
    forbidden,
    toast,
    dialogOpen,
    sprintDialogOpen,
    deleteTargetIssue,
    editingIssue,
    filters,
    dark,
    setFilters,
    toggleDark,
    setDialogOpen,
    setSprintDialogOpen,
    setDeleteTargetIssue,
    setEditingIssue,
    showToast,
    dismissToast,
    selectProject,
    retry,
    toggleChecklist,
    addChecklistItem,
    moveIssue,
    createIssue,
    updateIssue,
    updateSprint,
    deleteIssue,
    refreshProjects,
    addColumnOpen,
    setAddColumnOpen,
    editingColumn,
    setEditingColumn,
    reorderColumns,
    createColumn,
    updateColumn,
    deleteColumn,
    login,
    logout,
    refreshSession,
  };

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}
