"use client";

import { useMemo, useRef, useState } from "react";
import type { BoardColumn } from "../domain/types";
import { useBoard } from "../lib/store";
import { BoardColumnView } from "./BoardColumn";

export function Board() {
  const {
    issues,
    visibleIssues,
    moveIssue,
    columns,
    user,
    reorderColumns,
    setAddColumnOpen,
  } = useBoard();
  const isAdmin = user?.role === "admin";
  const [dragId, setDragId] = useState<number | null>(null);
  const dragEl = useRef<HTMLElement | null>(null);

  const visibleIds = useMemo(() => new Set(visibleIssues.map((i) => i.id)), [visibleIssues]);
  const hiddenIds = useMemo(
    () => new Set(issues.filter((i) => !visibleIds.has(i.id)).map((i) => i.id)),
    [issues, visibleIds],
  );

  const byColumn = useMemo(() => {
    const map = new Map<string, typeof issues>();
    for (const c of columns) map.set(c.key, []);
    for (const i of issues) {
      const bucket = map.get(i.status);
      if (bucket) bucket.push(i);
      else map.set(i.status, [i]);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position || a.id - b.id);
    return map;
  }, [issues, columns]);

  const handleMoveColumn = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= columns.length) return;
    const nextKeys = [...columns.map((c) => c.key)];
    const tmp = nextKeys[idx];
    nextKeys[idx] = nextKeys[targetIdx];
    nextKeys[targetIdx] = tmp;
    void reorderColumns(nextKeys);
  };

  const totalSlots = columns.length + (isAdmin ? 1 : 0);

  return (
    <div className="board-wrap">
      <section
        className="board"
        aria-label="Kanban board"
        style={
          totalSlots
            ? {
                gridTemplateColumns:
                  totalSlots <= 4
                    ? `repeat(${totalSlots}, minmax(330px, 1fr))`
                    : `repeat(${totalSlots}, 340px)`,
              }
            : undefined
        }
      >
        {columns.map((col: BoardColumn, idx: number) => (
          <BoardColumnView
            key={col.key}
            column={col}
            index={idx}
            totalColumns={columns.length}
            issues={byColumn.get(col.key) ?? []}
            hiddenIds={hiddenIds}
            dragId={dragId}
            onMoveColumn={handleMoveColumn}
            onDragStart={(id, el) => {
              setDragId(id);
              dragEl.current = el;
              requestAnimationFrame(() => el.classList.add("dragging"));
            }}
            onDragEnd={() => {
              dragEl.current?.classList.remove("dragging");
              dragEl.current = null;
              setDragId(null);
              document
                .querySelectorAll(".col-body.dragover")
                .forEach((z) => z.classList.remove("dragover"));
            }}
            onDropCard={(targetColumn, beforeIssueId) => {
              const id = dragId;
              dragEl.current?.classList.remove("dragging");
              dragEl.current = null;
              setDragId(null);
              if (id == null) return;
              const list = byColumn.get(targetColumn) ?? [];
              const normalized =
                beforeIssueId === id ? nextSiblingOf(id, list) : beforeIssueId;
              void moveIssue(id, targetColumn, normalized);
            }}
          />
        ))}

        {isAdmin && (
          <div className="col-add-card" role="region" aria-label="Add new column">
            <button
              type="button"
              className="btn-chunk btn-new"
              style={{ width: "100%", justifyContent: "center", minHeight: 44 }}
              onClick={() => setAddColumnOpen(true)}
            >
              + ADD COLUMN
            </button>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              Admin · Stage Management
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function nextSiblingOf(id: number, column: { id: number }[]): number | null {
  const idx = column.findIndex((c) => c.id === id);
  const next = idx >= 0 ? column[idx + 1] : null;
  return next ? next.id : null;
}
