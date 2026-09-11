"use client";

import { useBoard } from "../lib/store";

export function NewIssueButton() {
  const { setDialogOpen } = useBoard();
  return (
    <button className="btn-chunk btn-new" onClick={() => setDialogOpen(true)}>
      + New Issue
    </button>
  );
}
