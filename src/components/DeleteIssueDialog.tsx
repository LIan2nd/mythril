"use client";

import { useRef, useState } from "react";
import { useBoard } from "../lib/store";
import { FocusTrap } from "./FocusTrap";

export function DeleteIssueDialog() {
  const { deleteTargetIssue, setDeleteTargetIssue, deleteIssue } = useBoard();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  if (!deleteTargetIssue) return null;

  const close = () => {
    if (submitting) return;
    setDeleteTargetIssue(null);
    setError(null);
  };

  const confirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await deleteIssue(deleteTargetIssue.id);
      setDeleteTargetIssue(null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Failed to delete issue");
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
      <FocusTrap active={Boolean(deleteTargetIssue)} containerRef={dialogRef} onEscape={close} />
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delIssueTitle"
        ref={dialogRef}
      >
        <div className="dialog-head">
          <h2 id="delIssueTitle">Delete Issue</h2>
          <button
            className="btn-chunk btn-ghost"
            style={{ padding: "6px 12px", boxShadow: "none" }}
            onClick={close}
            aria-label="Close dialog"
            disabled={submitting}
          >
            ✕
          </button>
        </div>
        <div className="dialog-body">
          {error && (
            <div className="form-error-banner" role="alert">
              <strong>Error:</strong> <span>{error}</span>
            </div>
          )}
          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5 }}>
            Are you sure you want to permanently delete{" "}
            <strong>{deleteTargetIssue.key}</strong> (&ldquo;{deleteTargetIssue.title}&rdquo;)?
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--muted)" }}>
            This action cannot be undone. All checklists and activity will be permanently removed.
          </p>
        </div>
        <div className="dialog-foot">
          <button className="btn-chunk btn-ghost" onClick={close} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn-chunk btn-del"
            onClick={confirm}
            disabled={submitting}
          >
            {submitting ? "Deleting..." : "Delete Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}
