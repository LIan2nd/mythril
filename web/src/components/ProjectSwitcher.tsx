"use client";

import { useEffect, useRef, useState } from "react";
import { useBoard } from "../lib/store";

export function ProjectSwitcher() {
  const { projects, projectKey, selectProject, switching } = useBoard();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = projects.find((p) => p.key === projectKey) ?? projects[0];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open ]);

  return (
    <div className="proj-switch" ref={rootRef}>
      <button
        className="proj-btn"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={switching}
        onClick={() => setOpen((v) => !v)}
      >
        ▦ {active ? active.key : "···"} ▾
      </button>
      <div className={`proj-menu${open ? " open" : ""}`} role="menu">
        {projects.map((p) => (
          <button
            key={p.key}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void selectProject(p.key);
            }}
          >
            ▦ {p.key}{p.key === projectKey ? " — active" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}
