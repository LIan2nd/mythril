"use client";

import { useMemo, useRef, useState } from "react";
import type { BoardColumn } from "../domain/types";
import { useBoard } from "../lib/store";
import { BoardColumnView } from "./BoardColumn";

export function Board() {
  const { issues, visibleIssues, moveIssue, columns } = useBoard();
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

  return (
    <section className="board" aria-label="Kanban board" style={columns.length ? { gridTemplateColumns: `repeat(${columns.length},minmax(0,1fr))` } : undefined}>
      {columns.map((col: BoardColumn) => (
        <BoardColumnView
          key={col.key}
          column={col}
          issues={byColumn.get(col.key) ?? []}
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
            const list = byColumn.get(targetColumn) ?? [];
            const normalized =
              beforeIssueId === id ? nextSiblingOf(id, list) : beforeIssueId;
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
