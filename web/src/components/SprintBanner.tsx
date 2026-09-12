"use client";

import { computeSprintStats } from "../domain/types";
import { useBoard } from "../lib/store";

export function SprintBanner() {
  const { board, issues, columns } = useBoard();
  const stats = computeSprintStats(issues, columns);
  const sprint = board?.sprint;

  return (
    <section className="sprint-banner" aria-label="Sprint overview">
      <div className="left">
        <p className="kicker">{sprint?.kicker ?? "Active sprint"}</p>
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
            color: "var(--muted)",
            margin: "12px 0 0",
          }}
        >
          YELLOW = ACTIVE SPRINT · CORAL = HIGH BUG · MINT = DONE · LAVENDER = BACKLOG
        </p>
      </div>
    </section>
  );
}
