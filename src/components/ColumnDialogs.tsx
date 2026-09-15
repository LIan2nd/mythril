"use client";

import { useEffect, useState } from "react";
import type { ColumnColor, ColumnKind } from "../domain/types";
import { useBoard } from "../lib/store";
import { CustomSelect } from "./CustomSelect";

const KIND_OPTIONS: { value: ColumnKind; label: string }[] = [
  { value: "backlog", label: "Backlog / To Do" },
  { value: "active", label: "Active Sprint / Working" },
  { value: "review", label: "Review / Testing" },
  { value: "done", label: "Done / Completed" },
];

const COLOR_OPTIONS: { value: ColumnColor; label: string }[] = [
  { value: "lavender", label: "Lavender (Purple)" },
  { value: "yellow", label: "Yellow" },
  { value: "coral", label: "Coral (Red / Orange)" },
  { value: "mint", label: "Mint (Green)" },
  { value: "sky", label: "Sky (Blue)" },
];

export function AddColumnDialog() {
  const { addColumnOpen, setAddColumnOpen, createColumn } = useBoard();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<ColumnKind>("active");
  const [color, setColor] = useState<ColumnColor>("yellow");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (addColumnOpen) {
      setLabel("");
      setKind("active");
      setColor("yellow");
      setError(null);
      setBusy(false);
    }
  }, [addColumnOpen]);

  if (!addColumnOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Column label is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createColumn({ label: trimmed, kind, color });
      setAddColumnOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create column");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) setAddColumnOpen(false);
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Add Column">
        <div className="dialog-head">
          <h2>Add Board Column</h2>
          <button
            type="button"
            className="btn-chunk btn-ghost"
            style={{ padding: "6px 12px", boxShadow: "none" }}
            onClick={() => setAddColumnOpen(false)}
            aria-label="Close dialog"
            disabled={busy}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dialog-body">
            {error && (
              <div
                className="banner-alert"
                style={{
                  border: "2px solid var(--line)",
                  background: "var(--coral)",
                  color: "var(--fixed-ink)",
                  padding: "10px",
                  fontWeight: 700,
                  marginBottom: 16,
                  textTransform: "uppercase",
                  fontSize: 12,
                }}
              >
                ⚠ {error}
              </div>
            )}

            <div className="field">
              <label htmlFor="addColumnLabel">Column Label</label>
              <input
                id="addColumnLabel"
                className="input"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Quality Assurance"
                autoFocus
                disabled={busy}
              />
            </div>

            <div className="field">
              <label htmlFor="addColumnKind">Stage / Kind</label>
              <CustomSelect
                id="addColumnKind"
                aria-label="Stage or kind"
                value={kind}
                options={KIND_OPTIONS}
                onChange={setKind}
                disabled={busy}
              />
            </div>

            <div className="field">
              <label htmlFor="addColumnColor">Header Accent Color</label>
              <CustomSelect
                id="addColumnColor"
                aria-label="Header accent color"
                value={color}
                options={COLOR_OPTIONS}
                onChange={setColor}
                disabled={busy}
              />
            </div>
          </div>

          <div className="dialog-foot">
            <button
              type="button"
              className="btn-chunk btn-ghost"
              onClick={() => setAddColumnOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn-chunk btn-new" disabled={busy}>
              {busy ? "Creating..." : "+ Create Column"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditColumnDialog() {
  const { editingColumn, setEditingColumn, updateColumn, deleteColumn, issues } = useBoard();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<ColumnKind>("active");
  const [color, setColor] = useState<ColumnColor>("yellow");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (editingColumn) {
      setLabel(editingColumn.label);
      setKind(editingColumn.kind);
      setColor(editingColumn.color);
      setError(null);
      setBusy(false);
      setConfirmDelete(false);
    }
  }, [editingColumn]);

  if (!editingColumn) return null;

  const issueCount = issues.filter((i) => i.status === editingColumn.key).length;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Column label is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateColumn(editingColumn.key, { label: trimmed, kind, color });
      setEditingColumn(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update column");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (issueCount > 0) {
      setError(`Cannot delete column: it still contains ${issueCount} active issue${issueCount === 1 ? "" : "s"}. Move or delete those issues first.`);
      setConfirmDelete(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteColumn(editingColumn.key);
      setEditingColumn(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete column");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) setEditingColumn(null);
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Edit Column">
        <div className="dialog-head">
          <h2>Column Settings: {editingColumn.label}</h2>
          <button
            type="button"
            className="btn-chunk btn-ghost"
            style={{ padding: "6px 12px", boxShadow: "none" }}
            onClick={() => setEditingColumn(null)}
            aria-label="Close dialog"
            disabled={busy}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleUpdate}>
          <div className="dialog-body">
            {error && (
              <div
                className="banner-alert"
                style={{
                  border: "2px solid var(--line)",
                  background: "var(--coral)",
                  color: "var(--fixed-ink)",
                  padding: "10px",
                  fontWeight: 700,
                  marginBottom: 16,
                  textTransform: "uppercase",
                  fontSize: 12,
                }}
              >
                ⚠ {error}
              </div>
            )}

            <div className="field">
              <label htmlFor="editColumnLabel">Column Label</label>
              <input
                id="editColumnLabel"
                className="input"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="field">
              <label htmlFor="editColumnKind">Stage / Kind</label>
              <CustomSelect
                id="editColumnKind"
                aria-label="Stage or kind"
                value={kind}
                options={KIND_OPTIONS}
                onChange={setKind}
                disabled={busy}
              />
            </div>

            <div className="field">
              <label htmlFor="editColumnColor">Header Accent Color</label>
              <CustomSelect
                id="editColumnColor"
                aria-label="Header accent color"
                value={color}
                options={COLOR_OPTIONS}
                onChange={setColor}
                disabled={busy}
              />
            </div>

            <div
              style={{
                marginTop: 20,
                padding: "12px",
                border: "2px solid var(--line)",
                background: "var(--surface-2)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 13, textTransform: "uppercase" }}>Delete Stage</strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--muted)" }}>
                    {issueCount > 0
                      ? `Has ${issueCount} active card${issueCount === 1 ? "" : "s"}. Must be empty to delete.`
                      : "No cards currently in this column."}
                  </p>
                </div>
                {confirmDelete ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="btn-chunk btn-ghost"
                      onClick={() => setConfirmDelete(false)}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-chunk btn-del"
                      onClick={handleDelete}
                      disabled={busy}
                    >
                      Confirm Delete
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-chunk btn-del"
                    onClick={() => {
                      if (issueCount > 0) {
                        setError(`Cannot delete column: it still contains ${issueCount} active issue${issueCount === 1 ? "" : "s"}. Move them to another column first.`);
                        return;
                      }
                      setConfirmDelete(true);
                    }}
                    disabled={busy}
                  >
                    Delete Column
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="dialog-foot">
            <button
              type="button"
              className="btn-chunk btn-ghost"
              onClick={() => setEditingColumn(null)}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn-chunk btn-new" disabled={busy}>
              {busy ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
