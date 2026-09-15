"use client";

import { useRef } from "react";
import { columnIndexOf, type Issue } from "../domain/types";
import { useBoard } from "../lib/store";
import { AvatarStack } from "./AvatarStack";
import { ChecklistRow } from "./ChecklistRow";
import { MoveButtons } from "./MoveButtons";
import { ProgressBar } from "./ProgressBar";

interface IssueCardProps {
  issue: Issue;
  hidden: boolean;
  dragging: boolean;
  onDragStart: (id: number, el: HTMLElement) => void;
  onDragEnd: () => void;
}

function priClass(p: Issue["priority"]): string {
  return p === "HIGH" ? "b-high" : p === "MED" ? "b-med" : "b-low";
}

function focusCard(id: number) {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`.card[data-id="${id}"]`)?.focus?.();
  });
}

export function IssueCard({ issue, hidden, dragging, onDragStart, onDragEnd }: IssueCardProps) {
  const { moveIssue, visibleIssues, columns, setEditingIssue } = useBoard();
  const ref = useRef<HTMLElement>(null);
  const statusIndex = columnIndexOf(columns, issue.status);
  const done = issue.checklist.filter((c) => c.done).length;

  const keyboardReorder = (key: string) => {
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const next = statusIndex + (key === "ArrowLeft" ? -1 : 1);
      if (next < 0 || next >= columns.length) return;
      const target = columns[next].key;
      void moveIssue(issue.id, target, null);
      focusCard(issue.id);
      return;
    }
    const columnCards = visibleIssues
      .filter((i) => i.status === issue.status)
      .sort((a, b) => a.position - b.position || a.id - b.id);
    const idx = columnCards.findIndex((i) => i.id === issue.id);
    if (idx < 0) return;
    if (key === "ArrowUp" && idx > 0) {
      void moveIssue(issue.id, issue.status, columnCards[idx - 1].id);
      focusCard(issue.id);
    } else if (key === "ArrowDown" && idx < columnCards.length - 1) {
      const afterNext = columnCards[idx + 2] ?? null;
      void moveIssue(issue.id, issue.status, afterNext ? afterNext.id : null);
      focusCard(issue.id);
    }
  };

  return (
    <article
      ref={ref}
      className={`card${hidden ? " hidden" : ""}${dragging ? " dragging" : ""}`}
      draggable
      tabIndex={0}
      data-id={String(issue.id)}
      title="Focus + arrow keys to reorder (↑↓ in column, ←→ across columns)"
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (
          e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight"
        ) {
          e.preventDefault();
          keyboardReorder(e.key);
        }
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(issue.id));
        e.dataTransfer.effectAllowed = "move";
        onDragStart(issue.id, e.currentTarget);
      }}
      onDragEnd={onDragEnd}
    >
      <div className="card-top">
        <span className="id-chip num">{issue.key}</span>
        <span className={`badge ${priClass(issue.priority)}`}>
          <span className="sq" />
          {issue.priority}
        </span>
        <span className={`badge ${issue.type === "BUG" ? "b-bug" : "b-task"}`}>{issue.type}</span>
        <button
          type="button"
          className="card-edit-btn"
          aria-label={`Edit ${issue.key}`}
          title={`Edit ${issue.key}`}
          onClick={(e) => {
            e.stopPropagation();
            setEditingIssue(issue);
          }}
        >
          ✎
        </button>
      </div>
      <h3
        className="card-title-clickable"
        title={`Click to edit ${issue.key}`}
        onClick={(e) => {
          e.stopPropagation();
          setEditingIssue(issue);
        }}
      >
        {issue.title}
      </h3>
      {(() => {
        const raw = issue.description?.trim() ?? "";
        if (!raw || raw.startsWith("Created from + New Issue")) return null;
        const truncated = raw.length > 120 ? `${raw.slice(0, 120)}…` : raw;
        return <p className="desc">{truncated}</p>;
      })()}
      <ul className="check">
        {issue.checklist.map((c) => (
          <ChecklistRow key={c.id} issueId={issue.id} item={c} />
        ))}
      </ul>
      <ProgressBar done={done} total={issue.checklist.length} />
      <div className="card-foot">
        <AvatarStack user={issue.assignee} />
        <MoveButtons issueId={issue.id} statusIndex={statusIndex} columnCount={columns.length} />
      </div>
    </article>
  );
}
