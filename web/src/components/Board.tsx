"use client";

import { useMemo, useRef, useState } from "react";
import { COLUMN_IDS, type ColumnId } from "../domain/types";
import { useBoard } from "../lib/store";
import { BoardColumn } from "./BoardColumn";

const COL_CLASSES: Record<ColumnId, string> = {
  todo: "col-todo",
  progress: "col-prog",
  review: "col-rev",
  shipped: "col-ship",
};

export function Board() {
  const { issues, visibleIssues, moveIssue } = useBoard();
  const [dragId, setDragId] = useState<number | null>(null);
  const dragEl = useRef<HTMLElement | null>(null);

  const visibleIds = useMemo(() => new Set(visibleIssues.map((i) => i.id)), [visibleIssues]);
  const hiddenIds = useMemo(
    () => new Set(issues.filter((i) => !visibleIds.has(i.id)).map((i) => i.id)),
    [issues, visibleIds],
  );

  const byColumn = useMemo(() => {
    const map = { todo: [], progress: [], review: [], shipped: [] } as Record<ColumnId, typeof issues>;
    for (const i of issues) map[i.status].push(i);
    for (const col of COLUMN_IDS) map[col].sort((a, b) => a.position - b.position || a.id - b.id);
    return map;
  }, [issues]);

  return (
    <section className="board" aria-label="Kanban board">
      {COLUMN_IDS.map((col) => (
        <BoardColumn
          key={col}
          column={col}
          className={COL_CLASSES[col]}
          issues={byColumn[col]}
          hiddenIds={hiddenIds}
          dragId={dragId}
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
            const normalized =
              beforeIssueId === id ? nextSiblingOf(id, byColumn[targetColumn]) : beforeIssueId;
            void moveIssue(id, targetColumn, normalized);
          }}
        />
      ))}
    </section>
  );
}

function nextSiblingOf(id: number, column: { id: number }[]): number | null {
  const idx = column.findIndex((c) => c.id === id);
  const next = idx >= 0 ? column[idx + 1] : null;
  return next ? next.id : null;
}
