"use client";

import { useEffect, useRef, useState } from "react";
import type { ColumnId, IssueType, Priority } from "../domain/types";
import { useBoard } from "../lib/store";
import { FocusTrap } from "./FocusTrap";

export function NewIssueDialog() {
  const { dialogOpen, setDialogOpen, createIssue, board } = useBoard();
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("MED");
  const [column, setColumn] = useState<ColumnId>("todo");
  const [issueType, setIssueType] = useState<IssueType>("TASK");
  const [assignee, setAssignee] = useState("MK");
  const [checks, setChecks] = useState("Repro steps confirmed\nAdd regression test");

  useEffect(() => {
    if (dialogOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      titleRef.current?.focus();
    }
  }, [dialogOpen]);

  if (!dialogOpen) return null;

  const close = () => {
    setDialogOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus?.());
  };

  const submit = () => {
    const checklistTexts = checks
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
    void createIssue({
      title: title.trim() || "Untitled issue",
      description: `Created from + New Issue · ${new Date().toLocaleDateString()}`,
      priority,
      type: issueType,
      status: column,
      assignee,
      checklistTexts: checklistTexts.length ? checklistTexts : ["Define scope", "Add test"],
    });
    close();
  };

  return (
    <div
      className="overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <FocusTrap active={dialogOpen} containerRef={dialogRef} onEscape={close} />
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlgTitle" ref={dialogRef}>
        <div className="dialog-head">
          <h2 id="dlgTitle">+ New Issue</h2>
          <button className="btn-chunk btn-ghost" style={{ padding: "6px 12px", boxShadow: "none" }} onClick={close}>
            ✕
          </button>
        </div>
        <div className="dialog-body">
          <div className="field">
            <label htmlFor="nTitle">Title</label>
            <input
              className="input"
              id="nTitle"
              ref={titleRef}
              value={title}
              placeholder="Fix checkout race condition"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="nPri">Priority</label>
              <select
                className="select"
                id="nPri"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option>HIGH</option>
                <option>MED</option>
                <option>LOW</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="nCol">Column</label>
              <select
                className="select"
                id="nCol"
                value={column}
                onChange={(e) => setColumn(e.target.value as ColumnId)}
              >
                <option value="todo">To Do</option>
                <option value="progress">In Progress</option>
                <option value="review">Code Review</option>
                <option value="shipped">Shipped</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="nType">Type</label>
              <select
                className="select"
                id="nType"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as IssueType)}
              >
                <option>BUG</option>
                <option>TASK</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="nWho">Assignee</label>
              <select
                className="select"
                id="nWho"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                {(board?.users ?? []).map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.code === "MK" ? "MK — You" : `${u.code} — ${u.name}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="nChecks">Checklist (one per line)</label>
            <textarea
              className="textarea"
              id="nChecks"
              value={checks}
              onChange={(e) => setChecks(e.target.value)}
            />
          </div>
        </div>
        <div className="dialog-foot">
          <button className="btn-chunk btn-ghost" onClick={close}>
            Cancel
          </button>
          <button className="btn-chunk btn-go" onClick={submit}>
            Create issue
          </button>
        </div>
      </div>
    </div>
  );
}
