"use client";

import { useBoard } from "../lib/store";

interface MoveButtonsProps {
  issueId: number;
  statusIndex: number;
  columnCount: number;
}

export function MoveButtons({ issueId, statusIndex, columnCount }: MoveButtonsProps) {
  const { issues, columns, moveIssue, deleteIssue } = useBoard();
  const issue = issues.find((i) => i.id === issueId);

  const step = (dir: -1 | 1) => {
    const next = statusIndex + dir;
    if (next < 0 || next >= columns.length || !issue) return;
    void moveIssue(issueId, columns[next].key, null);
  };

  return (
    <span className="moves">
      <button aria-label="Move left" disabled={statusIndex <= 0} onClick={(e) => { e.stopPropagation(); step(-1); }}>
        ←
      </button>
      <button
        aria-label="Move right"
        disabled={statusIndex >= columnCount - 1}
        onClick={(e) => { e.stopPropagation(); step(1); }}
      >
        →
      </button>
      <button
        className="del"
        aria-label="Delete issue"
        title={issue ? `Delete ${issue.key}` : "Delete issue"}
        onClick={(e) => {
          e.stopPropagation();
          void deleteIssue(issueId);
        }}
      >
        ✕
      </button>
    </span>
  );
}
