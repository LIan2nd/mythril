"use client";

import { COLUMN_IDS } from "../domain/types";
import { useBoard } from "../lib/store";

interface MoveButtonsProps {
  issueId: number;
  statusIndex: number;
}

export function MoveButtons({ issueId, statusIndex }: MoveButtonsProps) {
  const { issues, moveIssue, deleteIssue } = useBoard();
  const issue = issues.find((i) => i.id === issueId);

  const step = (dir: -1 | 1) => {
    const next = statusIndex + dir;
    if (next < 0 || next >= COLUMN_IDS.length || !issue) return;
    void moveIssue(issueId, COLUMN_IDS[next], null);
  };

  return (
    <span className="moves">
      <button aria-label="Move left" disabled={statusIndex <= 0} onClick={(e) => { e.stopPropagation(); step(-1); }}>
        ←
      </button>
      <button
        aria-label="Move right"
        disabled={statusIndex >= COLUMN_IDS.length - 1}
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
