"use client";

import { useBoard } from "../lib/store";

export function SprintChip() {
  const { board, setSprintDialogOpen } = useBoard();
  const sprint = board?.sprint;
  const days = sprint?.daysLeft ?? 0;
  const label = sprint ? `${days} DAY${days === 1 ? "" : "S"} LEFT` : "SETUP SPRINT";

  return (
    <button
      type="button"
      className="sprint-chip"
      title="Click to configure sprint duration and dates"
      onClick={() => setSprintDialogOpen(true)}
    >
      <span className="dot" />
      {" "}SPRINT #{sprint?.number ?? "–"} · <span>{label}</span>
      <span className="sprint-chip-edit" aria-hidden="true">✎</span>
    </button>
  );
}
