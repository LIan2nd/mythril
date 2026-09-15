"use client";

import type { ChecklistItem } from "../domain/types";
import { useBoard } from "../lib/store";

interface ChecklistRowProps {
  issueId: number;
  item: ChecklistItem;
}

export function ChecklistRow({ issueId, item }: ChecklistRowProps) {
  const { toggleChecklist } = useBoard();
  return (
    <li className={item.done ? "done" : ""}>
      <button
        className="cbox"
        aria-checked={item.done}
        aria-label={`Toggle ${item.text}`}
        onClick={(e) => {
          e.stopPropagation();
          void toggleChecklist(issueId, item.id);
        }}
      >
        ✓
      </button>
      <span className="txt">{item.text}</span>
    </li>
  );
}
