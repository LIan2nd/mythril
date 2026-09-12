import { describe, expect, it } from "vitest";
import type { BoardColumn, Issue } from "../domain/types";
import { columnIndexOf, computeSprintStats, sortIssuesForBoard } from "../domain/types";
import { applyIssueFilters, boardReducer } from "./board-reducer";

const COLS: BoardColumn[] = [
  { key: "back", label: "Backlog", kind: "backlog", color: "lavender", position: 0 },
  { key: "work", label: "Doing", kind: "active", color: "yellow", position: 1 },
  { key: "check", label: "Check", kind: "review", color: "coral", position: 2 },
  { key: "live", label: "Live", kind: "done", color: "mint", position: 3 },
  { key: "extra", label: "Extra", kind: "active", color: "sky", position: 4 },
];

function fakeIssue(over: Partial<Issue> & { id: number }): Issue {
  return {
    key: `MY-${over.id}`,
    projectId: 1,
    title: `Issue ${over.id}`,
    description: "",
    priority: "MED",
    type: "TASK",
    status: "todo",
    assignee: { code: "MK", name: "M. Kade", avatarColor: "yellow" },
    position: over.id,
    checklist: [],
    ...over,
  };
}

describe("boardReducer", () => {
  it("moves a card across columns with midpoint position", () => {
    const state = [
      fakeIssue({ id: 1, status: "todo", position: 0 }),
      fakeIssue({ id: 2, status: "progress", position: 0 }),
      fakeIssue({ id: 3, status: "progress", position: 1 }),
    ];
    const next = boardReducer(state, { type: "MOVE", issueId: 1, status: "progress", beforeIssueId: 3 });
    const moved = next.find((i) => i.id === 1)!;
    expect(moved.status).toBe("progress");
    expect(moved.position).toBeLessThan(1);
  });

  it("toggles checklist items", () => {
    const state = [
      fakeIssue({
        id: 1,
        checklist: [{ id: 10, text: "Scope", done: false, position: 0 }],
      }),
    ];
    const next = boardReducer(state, { type: "TOGGLE_ITEM", issueId: 1, itemId: 10, done: true });
    expect(next[0].checklist[0].done).toBe(true);
  });

  it("reconciles optimistic creates by temp id", () => {
    const temp = fakeIssue({ id: -1, key: "···" });
    const created = fakeIssue({ id: 110, key: "MY-110" });
    const next = boardReducer([temp], { type: "RECONCILE_CREATE", tempId: -1, issue: created });
    expect(next).toEqual([created]);
  });

  it("removes on delete", () => {
    const state = [fakeIssue({ id: 1 }), fakeIssue({ id: 2 })];
    expect(boardReducer(state, { type: "REMOVE", issueId: 1 }).map((i) => i.id)).toEqual([2]);
  });
});

describe("applyIssueFilters", () => {
  const jt = { code: "JT", name: "J. Torres", avatarColor: "sky" };
  const issues = [
    fakeIssue({ id: 1, key: "MY-104", title: "Avatar upload corrupts", priority: "HIGH", type: "BUG" }),
    fakeIssue({ id: 2, key: "MY-105", title: "Empty states", assignee: jt }),
  ];
  it("filters mine by session code", () => {
    expect(applyIssueFilters(issues, { mine: true, mineCode: "MK", urgent: false, query: "" })).toHaveLength(1);
    expect(applyIssueFilters(issues, { mine: true, mineCode: "JT", urgent: false, query: "" })[0].id).toBe(2);
  });
  it("filters urgent HIGH+BUG", () => {
    expect(applyIssueFilters(issues, { mine: false, mineCode: null, urgent: true, query: "" })[0].id).toBe(1);
  });
  it("matches key or title case-insensitively", () => {
    expect(applyIssueFilters(issues, { mine: false, mineCode: null, urgent: false, query: "my-105" })).toHaveLength(1);
    expect(applyIssueFilters(issues, { mine: false, mineCode: null, urgent: false, query: "avatar" })).toHaveLength(1);
  });
});

describe("dynamic columns", () => {
  it("moves across custom keys with midpoint position", () => {
    const state = [
      fakeIssue({ id: 1, status: "back", position: 0 }),
      fakeIssue({ id: 2, status: "work", position: 0 }),
      fakeIssue({ id: 3, status: "work", position: 1 }),
    ];
    const next = boardReducer(state, { type: "MOVE", issueId: 1, status: "work", beforeIssueId: 3 });
    const moved = next.find((i) => i.id === 1)!;
    expect(moved.status).toBe("work");
    expect(moved.position).toBeLessThan(1);
  });

  it("moves into a fifth column by key", () => {
    const state = [fakeIssue({ id: 1, status: "back", position: 0 })];
    const next = boardReducer(state, { type: "MOVE", issueId: 1, status: "extra", beforeIssueId: null });
    expect(next[0].status).toBe("extra");
  });

  it("columnIndexOf follows column order", () => {
    expect(columnIndexOf(COLS, "extra")).toBe(4);
    expect(columnIndexOf(COLS, "missing")).toBe(COLS.length);
  });

  it("sortIssuesForBoard orders by dynamic columns then position", () => {
    const issues = [
      fakeIssue({ id: 1, status: "live", position: 5 }),
      fakeIssue({ id: 2, status: "back", position: 9 }),
      fakeIssue({ id: 3, status: "back", position: 1 }),
    ];
    expect(sortIssuesForBoard(issues, COLS).map((i) => i.id)).toEqual([3, 2, 1]);
  });

  it("computeSprintStats uses done/review kinds", () => {
    const issues = [
      fakeIssue({ id: 1, status: "live", priority: "HIGH", type: "BUG" }),
      fakeIssue({ id: 2, status: "check", priority: "HIGH", type: "BUG" }),
      fakeIssue({ id: 3, status: "back" }),
    ];
    const stats = computeSprintStats(issues, COLS);
    expect(stats.done).toBe(1);
    expect(stats.inReview).toBe(1);
    expect(stats.highBugs).toBe(1);
    expect(stats.pct).toBe(33);
  });
});
