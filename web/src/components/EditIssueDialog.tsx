"use client";

import { useEffect, useRef, useState } from "react";
import type { IssueType, Priority } from "../domain/types";
import { useBoard } from "../lib/store";
import { FocusTrap } from "./FocusTrap";
import { CustomSelect } from "./CustomSelect";

export function EditIssueDialog() {
  const { editingIssue, setEditingIssue, updateIssue, toggleChecklist, addChecklistItem, issues, board, columns } =
    useBoard();

  const currentIssue = issues.find((i) => i.id === editingIssue?.id) ?? editingIssue;

  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MED");
  const [column, setColumn] = useState("");
  const [issueType, setIssueType] = useState<IssueType>("TASK");
  const [assignee, setAssignee] = useState("");

  const [newCheckText, setNewCheckText] = useState("");
  const [newCheckError, setNewCheckError] = useState<string | null>(null);
  const [addingCheck, setAddingCheck] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (editingIssue) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      titleRef.current?.focus();
      setServerError(null);
      setSubmitted(false);
      setNewCheckText("");
      setNewCheckError(null);

      setTitle(editingIssue.title);
      const rawDesc = editingIssue.description?.trim() ?? "";
      setDescription(rawDesc.startsWith("Created from + New Issue") ? "" : rawDesc);
      setPriority(editingIssue.priority);
      setColumn(editingIssue.status);
      setIssueType(editingIssue.type);
      setAssignee(editingIssue.assignee.code);
    }
  }, [editingIssue]);

  if (!editingIssue || !currentIssue) return null;

  const close = () => {
    if (submitting) return;
    setEditingIssue(null);
    setServerError(null);
    setSubmitted(false);
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

  const hasClientError = Boolean(titleError || descError || assigneeError);

  const submit = async () => {
    setSubmitted(true);
    if (hasClientError || submitting) return;

    setSubmitting(true);
    setServerError(null);
    try {
      await updateIssue(currentIssue.id, {
        title: trimmedTitle,
        description: description.trim(),
        priority,
        type: issueType,
        status: column,
        assignee,
      });
      close();
    } catch (err) {
      setServerError(err instanceof Error && err.message ? err.message : "Failed to update issue");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddChecklist = async () => {
    const trimmed = newCheckText.trim();
    if (!trimmed) {
      setNewCheckError("Checklist item cannot be empty");
      return;
    }
    if (trimmed.length > 200) {
      setNewCheckError("Checklist item must be 200 characters or fewer");
      return;
    }
    if (currentIssue.checklist.length >= 5) {
      setNewCheckError("Maximum 5 checklist items allowed");
      return;
    }

    setAddingCheck(true);
    setNewCheckError(null);
    try {
      await addChecklistItem(currentIssue.id, trimmed);
      setNewCheckText("");
    } catch (err) {
      setNewCheckError(err instanceof Error && err.message ? err.message : "Failed to add checklist item");
    } finally {
      setAddingCheck(false);
    }
  };

  return (
    <div
      className="overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <FocusTrap active={Boolean(editingIssue)} containerRef={dialogRef} onEscape={close} />
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="editDlgTitle" ref={dialogRef}>
        <div className="dialog-head">
          <h2 id="editDlgTitle">Edit Issue · {currentIssue.key}</h2>
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
            <label htmlFor="eTitle">Title</label>
            <input
              className={`input${submitted && titleError ? " input-error" : ""}`}
              id="eTitle"
              ref={titleRef}
              value={title}
              placeholder="Issue title"
              onChange={(e) => {
                setTitle(e.target.value);
                if (serverError) setServerError(null);
              }}
              aria-invalid={Boolean(submitted && titleError)}
              aria-describedby={submitted && titleError ? "eTitleError" : undefined}
            />
            {submitted && titleError && (
              <span className="field-error-msg" id="eTitleError" role="alert">
                ⚠ {titleError}
              </span>
            )}
          </div>
          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="eDesc">Description</label>
              <span className="kicker" style={{ margin: 0, fontSize: "11px" }}>
                {description.length}/300
              </span>
            </div>
            <textarea
              className={`textarea${submitted && descError ? " input-error" : ""}`}
              id="eDesc"
              rows={2}
              maxLength={300}
              value={description}
              placeholder="Optional short description of the issue..."
              onChange={(e) => {
                setDescription(e.target.value);
                if (serverError) setServerError(null);
              }}
              aria-invalid={Boolean(submitted && descError)}
              aria-describedby={submitted && descError ? "eDescError" : undefined}
            />
            {submitted && descError && (
              <span className="field-error-msg" id="eDescError" role="alert">
                ⚠ {descError}
              </span>
            )}
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="ePri">Priority</label>
              <CustomSelect<Priority>
                id="ePri"
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
              <label htmlFor="eCol">Column</label>
              <CustomSelect
                id="eCol"
                value={column}
                options={columns.map((c) => ({ value: c.key, label: c.label }))}
                onChange={(val) => setColumn(val)}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="eType">Type</label>
              <CustomSelect<IssueType>
                id="eType"
                value={issueType}
                options={[
                  { value: "BUG", label: "BUG" },
                  { value: "TASK", label: "TASK" },
                ]}
                onChange={(val) => setIssueType(val)}
              />
            </div>
            <div className="field">
              <label htmlFor="eWho">Assignee</label>
              <CustomSelect
                id="eWho"
                className={submitted && assigneeError ? "input-error" : ""}
                value={assignee}
                placeholder="Select an assignee..."
                options={[
                  { value: "", label: "Select an assignee..." },
                  ...(board?.users ?? []).map((u) => ({
                    value: u.code ?? "",
                    label: `${u.code} — ${u.displayName}`,
                  })),
                ]}
                onChange={(val) => {
                  setAssignee(val);
                  if (serverError) setServerError(null);
                }}
                aria-invalid={Boolean(submitted && assigneeError)}
                aria-describedby={submitted && assigneeError ? "eWhoError" : undefined}
              />
              {submitted && assigneeError && (
                <span className="field-error-msg" id="eWhoError" role="alert">
                  ⚠ {assigneeError}
                </span>
              )}
            </div>
          </div>

          <div className="field">
            <label>Checklist ({currentIssue.checklist.length}/5)</label>
            <div className="edit-checklist-container">
              {currentIssue.checklist.length === 0 ? (
                <p className="kicker" style={{ margin: "4px 0 8px 0", fontSize: "11px", color: "var(--muted)" }}>
                  No checklist items yet.
                </p>
              ) : (
                <ul className="edit-checklist-list">
                  {currentIssue.checklist.map((item) => (
                    <li key={item.id} className="edit-checklist-item">
                      <label className="edit-checklist-label">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => void toggleChecklist(currentIssue.id, item.id)}
                        />
                        <span className={item.done ? "done-text" : ""}>{item.text}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}

              {currentIssue.checklist.length < 5 ? (
                <div className="edit-checklist-add">
                  <input
                    className={`input${newCheckError ? " input-error" : ""}`}
                    placeholder="Add a checklist item (press Enter)..."
                    value={newCheckText}
                    maxLength={200}
                    disabled={addingCheck}
                    onChange={(e) => {
                      setNewCheckText(e.target.value);
                      if (newCheckError) setNewCheckError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleAddChecklist();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-chunk btn-ghost"
                    style={{ padding: "8px 14px", flexShrink: 0 }}
                    onClick={() => void handleAddChecklist()}
                    disabled={addingCheck || !newCheckText.trim()}
                  >
                    {addingCheck ? "Adding..." : "+ Add"}
                  </button>
                </div>
              ) : (
                <p className="kicker" style={{ margin: "6px 0 0 0", fontSize: "11px", color: "var(--muted)" }}>
                  Maximum 5 checklist items reached.
                </p>
              )}
              {newCheckError && (
                <span className="field-error-msg" role="alert">
                  ⚠ {newCheckError}
                </span>
              )}
            </div>
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
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
