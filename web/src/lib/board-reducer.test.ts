import { describe, expect, it } from "vitest";
import type { Issue } from "../domain/types";
import { applyIssueFilters, boardReducer } from "./board-reducer";

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
  it("filters mine by MK", () => {
    expect(applyIssueFilters(issues, { mine: true, urgent: false, query: "" })).toHaveLength(1);
  });
  it("filters urgent HIGH+BUG", () => {
    expect(applyIssueFilters(issues, { mine: false, urgent: true, query: "" })[0].id).toBe(1);
  });
  it("matches key or title case-insensitively", () => {
    expect(applyIssueFilters(issues, { mine: false, urgent: false, query: "my-105" })).toHaveLength(1);
    expect(applyIssueFilters(issues, { mine: false, urgent: false, query: "avatar" })).toHaveLength(1);
  });
});
