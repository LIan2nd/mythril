"use client";

import { useBoard } from "../lib/store";

export function ErrorPanel() {
  const { loadError, retry } = useBoard();
  return (
    <div className="error-panel" role="alert">
      <strong>BOARD FAILED TO LOAD</strong>
      <span>{loadError ?? "Unknown error"}</span>
      <button className="btn-chunk btn-new" onClick={retry}>
        Retry
      </button>
    </div>
  );
}
