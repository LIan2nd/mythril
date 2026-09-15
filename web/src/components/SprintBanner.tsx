"use client";

import { computeSprintStats } from "../domain/types";
import { useBoard } from "../lib/store";

export function SprintBanner() {
  const { board, issues, columns, setSprintDialogOpen } = useBoard();
  const stats = computeSprintStats(issues, columns);
  const sprint = board?.sprint;

  return (
    <section className="sprint-banner" aria-label="Sprint overview">
      <div className="left">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <p className="kicker" style={{ margin: 0 }}>{sprint?.kicker ?? "Active sprint"}</p>
          <button
            type="button"
            className="btn-chunk btn-ghost"
            style={{
              padding: "4px 8px",
              fontSize: 11,
              background: "var(--surface)",
              color: "var(--fixed-ink)",
              border: "2px solid var(--line)",
              boxShadow: "2px 2px 0 var(--line)",
              cursor: "pointer",
            }}
            onClick={() => setSprintDialogOpen(true)}
            title="Configure sprint dates and duration"
          >
            ✎ Edit Sprint
          </button>
        </div>
        <h1>{sprint?.title ?? "Forge the sprint. Ship like legend."}</h1>
        <div className="meter" aria-label="Sprint completion">
          <i style={{ width: `${stats.pct}%` }} />
        </div>
        <p className="kicker" style={{ margin: "10px 0 0" }}>
          <span className="num">{stats.pct}%</span> SHIPPED ·{" "}
          <span className="num">
            {stats.done}/{stats.total}
          </span>{" "}
          ISSUES
        </p>
      </div>
      <div className="right">
        <p className="kicker">Sprint health</p>
        <div className="stat-grid" style={{ border: "3px solid var(--line)", marginTop: 0 }}>
          <div>
            <div className="n num">{stats.open}</div>
            <div className="l">Open</div>
          </div>
          <div>
            <div className="n num">{stats.highBugs}</div>
            <div className="l">High bugs</div>
          </div>
          <div>
            <div className="n num">{stats.inReview}</div>
            <div className="l">In review</div>
          </div>
          <div>
            <div className="n num">{stats.done}</div>
            <div className="l">Shipped</div>
          </div>
        </div>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: stats.highBugs > 0 ? "var(--coral)" : "var(--muted)",
            margin: "12px 0 0",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {stats.total === 0
            ? "● NO ISSUES IN ACTIVE SPRINT"
            : stats.highBugs > 0
            ? `⚠ ${stats.highBugs} HIGH BUG${stats.highBugs > 1 ? "S" : ""} BLOCKING PROGRESS`
            : stats.done === stats.total
            ? "✓ ALL SPRINT OBJECTIVES SHIPPED"
            : "● SPRINT HEALTH: ON TRACK"}
        </p>
      </div>
    </section>
  );
}
