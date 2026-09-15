"use client";

import { useBoard } from "../lib/store";

export function Footer() {
  const { board } = useBoard();
  const sprintNum = board?.sprint?.number;
  const year = new Date().getFullYear();

  return (
    <footer className="foot">
      <span>© {year} MYTHRIL{sprintNum ? ` · SPRINT #${sprintNum}` : ""}</span>
      <span>● SYSTEM ONLINE</span>
    </footer>
  );
}
