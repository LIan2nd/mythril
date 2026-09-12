"use client";

import { useRef, useState } from "react";
import type { BoardColumn as BoardColumnType, Issue } from "../domain/types";
import { useBoard } from "../lib/store";
import { IssueCard } from "./IssueCard";

interface BoardColumnViewProps {
  column: BoardColumnType;
  issues: Issue[];
  hiddenIds: Set<number>;
  dragId: number | null;
  onDragStart: (id: number, el: HTMLElement) => void;
  onDragEnd: () => void;
  onDropCard: (targetColumn: string, beforeIssueId: number | null) => void;
}

export function BoardColumnView({
  column,
  issues,
  hiddenIds,
  dragId,
  onDragStart,
  onDragEnd,
  onDropCard,
}: BoardColumnViewProps) {
  const { moveIssue } = useBoard();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  void moveIssue;

  const pickTarget = (clientY: number): number | null => {
    const body = bodyRef.current;
    if (!body) return null;
    const cards = [...body.querySelectorAll<HTMLElement>(".card:not(.dragging):not(.hidden)")];
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return Number(c.dataset.id);
    }
    return null;
  };

  return (
    <div className="col" data-col={column.key}>
      <div className={`col-head colhead-${column.color}`}>
        <h2>{column.label}</h2>
        <span className="count num" data-count>
          {String(issues.length).padStart(2, "0")}
        </span>
      </div>
      <div
        ref={bodyRef}
        className={`col-body${over ? " dragover" : ""}`}
        data-drop={column.key}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setOver(true);
          const host = bodyRef.current?.querySelector<HTMLElement>(".card.dragging");
          if (!host) return;
          const beforeId = pickTarget(e.clientY);
          const before =
            beforeId == null ? null : bodyRef.current?.querySelector(`.card[data-id="${beforeId}"]`);
          if (before == null) bodyRef.current?.appendChild(host);
          else if (before !== host) bodyRef.current?.insertBefore(host, before);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const beforeId = pickTarget(e.clientY);
          onDropCard(column.key, beforeId);
        }}
      >
        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            hidden={hiddenIds.has(issue.id)}
            dragging={dragId === issue.id}
            onDragStart={onDragStart}
            onDragEnd={() => {
              setOver(false);
              onDragEnd();
            }}
          />
        ))}
        {issues.length === 0 || issues.every((i) => hiddenIds.has(i.id)) ? (
          <div className="empty">Drop cards here</div>
        ) : null}
      </div>
    </div>
  );
}

export const BoardColumn = BoardColumnView;
