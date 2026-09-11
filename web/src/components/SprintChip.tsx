"use client";

import { useBoard } from "../lib/store";

export function SprintChip() {
  const { board } = useBoard();
  const sprint = board?.sprint;
  const days = sprint?.daysLeft ?? 0;
  const label = `${days} DAY${days === 1 ? "" : "S"} LEFT`;
  return (
    <div className="sprint-chip" title="Active sprint">
      <span className="dot" />
      {" "}SPRINT #{sprint?.number ?? "–"} · <span>{label}</span>
    </div>
  );
}
