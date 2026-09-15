"use client";

import { useEffect, useRef, useState } from "react";
import type { IssueType, Priority } from "../domain/types";
import { defaultColumnByKind } from "../domain/types";
import { useBoard } from "../lib/store";
import { FocusTrap } from "./FocusTrap";
import { CustomSelect } from "./CustomSelect";

export function NewIssueDialog() {
  const { dialogOpen, setDialogOpen, createIssue, board, columns, user } = useBoard();
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MED");
  const fallbackColumn = columns[0]?.key ?? defaultColumnByKind(columns, "backlog")?.key ?? "todo";
  const [column, setColumn] = useState(fallbackColumn);
  const [issueType, setIssueType] = useState<IssueType>("TASK");
  const [assignee, setAssignee] = useState("");
  const [checks, setChecks] = useState("Repro steps confirmed\nAdd regression test");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (dialogOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      titleRef.current?.focus();
      setServerError(null);
      setSubmitted(false);
      setTitle("");
      setDescription("");
      if (columns.length && !columns.some((c) => c.key === column)) setColumn(columns[0].key);
      if (!assignee && board?.users.length) {
        const first = board.users.find((u) => u.code === user?.code) ?? board.users[0];
        if (first.code) setAssignee(first.code);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

  if (!dialogOpen) return null;

  const close = () => {
    if (submitting) return;
    setDialogOpen(false);
    setServerError(null);
    setSubmitted(false);
    setTitle("");
    setDescription("");
    requestAnimationFrame(() => triggerRef.current?.focus?.());
  };

  const trimmedTitle = title.trim();
  const titleError = !trimmedTitle
    ? "Title is required"
    : trimmedTitle.length > 120
    ? `Title must be 120 characters or fewer (currently ${trimmedTitle.length})`
    : null;

  const descError = description.length > 300 ? "Description must be 300 characters or fewer" : null;

  const assigneeError = !assignee ? "Please select an assignee" : null;

  const checklistLines = checks
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const checksError = checklistLines.length > 5 ? "Maximum 5 checklist items allowed" : null;

  const hasClientError = Boolean(titleError || descError || assigneeError || checksError);

  const submit = async () => {
    setSubmitted(true);
    if (hasClientError || submitting) return;

    setSubmitting(true);
    setServerError(null);
    try {
      await createIssue({
        title: trimmedTitle,
        description: description.trim(),
        priority,
        type: issueType,
        status: column,
        assignee,
        checklistTexts: checklistLines.length ? checklistLines.slice(0, 5) : ["Define scope", "Add test"],
      });
      close();
    } catch (err) {
      setServerError(err instanceof Error && err.message ? err.message : "Failed to create issue");
    } finally {
      setSubmitting(false);
    }
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
          <button
            className="btn-chunk btn-ghost"
            style={{ padding: "6px 12px", boxShadow: "none" }}
            onClick={close}
            disabled={submitting}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        <div className="dialog-body">
          {serverError && (
            <div className="form-error-banner" role="alert">
              <strong>Server Error:</strong> <span>{serverError}</span>
            </div>
          )}
          <div className="field">
            <label htmlFor="nTitle">Title</label>
            <input
              className={`input${submitted && titleError ? " input-error" : ""}`}
              id="nTitle"
              ref={titleRef}
              value={title}
              placeholder="Fix checkout race condition"
              onChange={(e) => {
                setTitle(e.target.value);
                if (serverError) setServerError(null);
              }}
              aria-invalid={Boolean(submitted && titleError)}
              aria-describedby={submitted && titleError ? "nTitleError" : undefined}
            />
            {submitted && titleError && (
              <span className="field-error-msg" id="nTitleError" role="alert">
                ⚠ {titleError}
              </span>
            )}
          </div>
          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="nDesc">Description</label>
              <span className="kicker" style={{ margin: 0, fontSize: "11px" }}>
                {description.length}/300
              </span>
            </div>
            <textarea
              className={`textarea${submitted && descError ? " input-error" : ""}`}
              id="nDesc"
              rows={2}
              maxLength={300}
              value={description}
              placeholder="Optional short description of the issue..."
              onChange={(e) => {
                setDescription(e.target.value);
                if (serverError) setServerError(null);
              }}
              aria-invalid={Boolean(submitted && descError)}
              aria-describedby={submitted && descError ? "nDescError" : undefined}
            />
            {submitted && descError && (
              <span className="field-error-msg" id="nDescError" role="alert">
                ⚠ {descError}
              </span>
            )}
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="nPri">Priority</label>
              <CustomSelect<Priority>
                id="nPri"
                value={priority}
                options={[
                  { value: "HIGH", label: "HIGH" },
                  { value: "MED", label: "MED" },
                  { value: "LOW", label: "LOW" },
                ]}
                onChange={(val) => setPriority(val)}
              />
            </div>
            <div className="field">
              <label htmlFor="nCol">Column</label>
              <CustomSelect
                id="nCol"
                value={column}
                options={columns.map((c) => ({ value: c.key, label: c.label }))}
                onChange={(val) => setColumn(val)}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="nType">Type</label>
              <CustomSelect<IssueType>
                id="nType"
                value={issueType}
                options={[
                  { value: "BUG", label: "BUG" },
                  { value: "TASK", label: "TASK" },
                ]}
                onChange={(val) => setIssueType(val)}
              />
            </div>
            <div className="field">
              <label htmlFor="nWho">Assignee</label>
              <CustomSelect
                id="nWho"
                className={submitted && assigneeError ? "input-error" : ""}
                value={assignee}
                placeholder="Select an assignee..."
                options={[
                  { value: "", label: "Select an assignee..." },
                  ...(board?.users ?? []).map((u) => ({
                    value: u.code ?? "",
                    label: u.code === user?.code ? `${u.code} — You` : `${u.code} — ${u.displayName}`,
                  })),
                ]}
                onChange={(val) => {
                  setAssignee(val);
                  if (serverError) setServerError(null);
                }}
                aria-invalid={Boolean(submitted && assigneeError)}
                aria-describedby={submitted && assigneeError ? "nWhoError" : undefined}
              />
              {submitted && assigneeError && (
                <span className="field-error-msg" id="nWhoError" role="alert">
                  ⚠ {assigneeError}
                </span>
              )}
            </div>
          </div>
          <div className="field">
            <label htmlFor="nChecks">Checklist (one per line, max 5)</label>
            <textarea
              className={`textarea${submitted && checksError ? " input-error" : ""}`}
              id="nChecks"
              value={checks}
              onChange={(e) => {
                setChecks(e.target.value);
                if (serverError) setServerError(null);
              }}
              aria-invalid={Boolean(submitted && checksError)}
              aria-describedby={submitted && checksError ? "nChecksError" : undefined}
            />
            {submitted && checksError && (
              <span className="field-error-msg" id="nChecksError" role="alert">
                ⚠ {checksError}
              </span>
            )}
          </div>
        </div>
        <div className="dialog-foot">
          <button className="btn-chunk btn-ghost" onClick={close} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn-chunk btn-go"
            onClick={submit}
            disabled={submitting || (submitted && hasClientError)}
          >
            {submitting ? "Creating..." : "Create issue"}
          </button>
        </div>
      </div>
    </div>
  );
}
