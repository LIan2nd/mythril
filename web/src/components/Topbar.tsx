"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { avatarSrc } from "../lib/api";
import { useBoard } from "../lib/store";
import { NewIssueButton } from "./NewIssueButton";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { SearchBox } from "./SearchBox";
import { SprintChip } from "./SprintChip";

export function Topbar() {
  const { user, logout } = useBoard();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open ]);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="logo" aria-label="Mythril home">
          <span className="logo-mark">M</span> MYTHRIL
        </Link>
        <ProjectSwitcher />
        <SprintChip />
        <div className="topbar-actions">
          <SearchBox />
          <NewIssueButton />
          {user ? (
            <div className="proj-switch" ref={rootRef}>
              <button
                className="proj-btn user-chip"
                aria-haspopup="true"
                aria-expanded={open}
                aria-label={`Account menu for ${user.displayName}`}
                onClick={() => setOpen((v) => !v)}
              >
                <span className="avatar avatar-xs" aria-hidden="true">
                  {user.hasAvatar && user.code ? (
                    <img src={avatarSrc(user.code)} alt="" />
                  ) : (
                    (user.code ?? user.username.slice(0, 2).toUpperCase())
                  )}
                </span>
                {user.code ?? user.username}
                ▾
              </button>
              <div className={`proj-menu${open ? " open" : ""}`} role="menu">
                <Link href="/profile" role="menuitem" onClick={() => setOpen(false)} className="proj-menu-link">
                  Profile
                </Link>
                {user.role === "admin" ? (
                  <Link href="/admin" role="menuitem" onClick={() => setOpen(false)} className="proj-menu-link">
                    Admin panel
                  </Link>
                ) : null}
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    void logout();
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
