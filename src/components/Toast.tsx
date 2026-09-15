"use client";

import { useBoard } from "../lib/store";

export function Toast() {
  const { toast, dismissToast } = useBoard();
  if (!toast) return null;

  const type = toast.type || "info";
  const defaultTitle = type === "success" ? "Success" : type === "error" ? "Error" : "Notice";
  const title = toast.title || defaultTitle;
  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";

  return (
    <div
      key={toast.id}
      className={`toast toast-${type}`}
      role={type === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <div className="toast-badge" aria-hidden="true">
        {icon}
      </div>
      <div className="toast-content">
        <span className="toast-title">{title}</span>
        <span className="toast-msg">{toast.message}</span>
      </div>
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss notification"
        onClick={dismissToast}
      >
        ✕
      </button>
      <div className="toast-progress" aria-hidden="true" />
    </div>
  );
}
