"use client";

import { useBoard } from "../lib/store";

export function Toast() {
  const { toast, dismissToast } = useBoard();
  if (!toast) return null;
  return (
    <div className="toast" role="alert">
      {toast}{" "}
      <button
        aria-label="Dismiss error"
        onClick={dismissToast}
        style={{ background: "transparent", border: 0, fontWeight: 900 }}
      >
        ✕
      </button>
    </div>
  );
}
