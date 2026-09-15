"use client";

import { useEffect, useRef, useState } from "react";
import { useBoard } from "../lib/store";
import { FocusTrap } from "./FocusTrap";

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : getTodayStr();
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeDaysLeft(endStr: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endStr)) return 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const end = new Date(`${endStr}T00:00:00Z`);
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}

function computeDaysBetween(startStr: string, endStr: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endStr)) return 0;
  const start = new Date(`${startStr}T00:00:00Z`);
  const end = new Date(`${endStr}T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

const PRESETS = [
  { label: "1 Week (7d)", days: 7 },
  { label: "2 Weeks (14d)", days: 14 },
  { label: "3 Weeks (21d)", days: 21 },
  { label: "1 Month (30d)", days: 30 },
];

export function SprintSettingsDialog() {
  const { sprintDialogOpen, setSprintDialogOpen, board, updateSprint } = useBoard();
  const sprint = board?.sprint;

  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);

  const [number, setNumber] = useState(1);
  const [title, setTitle] = useState("Forge the sprint. Ship like legend.");
  const [kicker, setKicker] = useState("Active sprint");
  const [startsAt, setStartsAt] = useState(getTodayStr());
  const [endsAt, setEndsAt] = useState(addDays(getTodayStr(), 14));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sprintDialogOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      setError(null);
      if (sprint) {
        setNumber(sprint.number);
        setTitle(sprint.title || "Forge the sprint. Ship like legend.");
        setKicker(sprint.kicker || `Sprint #${sprint.number}`);
        setStartsAt(sprint.startsAt || getTodayStr());
        setEndsAt(sprint.endsAt || addDays(getTodayStr(), 14));
      } else {
        setNumber(1);
        setTitle("Forge the sprint. Ship like legend.");
        setKicker("Active sprint");
        setStartsAt(getTodayStr());
        setEndsAt(addDays(getTodayStr(), 14));
      }
      setTimeout(() => numberInputRef.current?.focus(), 50);
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [sprintDialogOpen, sprint]);

  if (!sprintDialogOpen) return null;

  const daysLeft = computeDaysLeft(endsAt);
  const durationDays = computeDaysBetween(startsAt, endsAt);

  const handlePreset = (days: number) => {
    const baseStart = startsAt || getTodayStr();
    setEndsAt(addDays(baseStart, days));
    setError(null);
  };

  const close = () => {
    if (saving) return;
    setSprintDialogOpen(false);
  };

  const submit = async () => {
    if (number < 1) {
      setError("Sprint number must be at least 1");
      return;
    }
    if (!startsAt) {
      setError("Please specify a start date");
      return;
    }
    if (!endsAt) {
      setError("Please specify an end date");
      return;
    }
    if (endsAt < startsAt) {
      setError("End date cannot be earlier than start date");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateSprint({
        number,
        title: title.trim(),
        kicker: kicker.trim(),
        startsAt,
        endsAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update sprint");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="overlay open"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sprintHeading"
      >
        <FocusTrap active={sprintDialogOpen} containerRef={dialogRef} onEscape={close} />
        <div className="dialog-head">
          <h2 id="sprintHeading">{sprint ? `Configure Sprint #${sprint.number}` : "Start New Sprint"}</h2>
          <button
            type="button"
            className="btn-chunk btn-ghost"
            style={{ padding: "6px 12px", boxShadow: "none" }}
            aria-label="Close dialog"
            onClick={close}
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <div className="dialog-body">
          {error && (
            <div className="banner banner-error" role="alert" style={{ margin: 0 }}>
              ⚠ {error}
            </div>
          )}

          <div className="form-row">
            <div className="field">
              <label htmlFor="sprintNum">Sprint Number</label>
              <input
                ref={numberInputRef}
                id="sprintNum"
                type="number"
                min="1"
                className="input"
                value={number}
                onChange={(e) => {
                  setNumber(Math.max(1, parseInt(e.target.value, 10) || 1));
                  if (error) setError(null);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="sprintKicker">Subtitle / Tagline</label>
              <input
                id="sprintKicker"
                type="text"
                className="input"
                placeholder="e.g. Active sprint"
                value={kicker}
                onChange={(e) => {
                  setKicker(e.target.value);
                  if (error) setError(null);
                }}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="sprintTitle">Sprint Goal / Title</label>
            <input
              id="sprintTitle"
              type="text"
              className="input"
              placeholder="e.g. Forge the sprint. Ship like legend."
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
            />
          </div>

          <div className="field">
            <label>Quick Duration Presets</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-label="Quick duration presets">
              {PRESETS.map((p) => {
                const isActive = durationDays === p.days;
                return (
                  <button
                    key={p.days}
                    type="button"
                    className={`btn-chunk ${isActive ? "btn-new" : "btn-ghost"}`}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                      border: "2px solid var(--line)",
                      boxShadow: isActive ? "var(--shadow-sm)" : "none",
                      transform: isActive ? "translate(-1px, -1px)" : "none",
                    }}
                    onClick={() => handlePreset(p.days)}
                    disabled={saving}
                  >
                    {isActive ? `✓ ${p.label}` : p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="sprintStart">Start Date</label>
              <input
                id="sprintStart"
                type="date"
                className="input"
                value={startsAt}
                onChange={(e) => {
                  setStartsAt(e.target.value);
                  if (error) setError(null);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="sprintEnd">End Date</label>
              <input
                id="sprintEnd"
                type="date"
                className="input"
                value={endsAt}
                onChange={(e) => {
                  setEndsAt(e.target.value);
                  if (error) setError(null);
                }}
              />
            </div>
          </div>

          <div
            style={{
              padding: "10px 14px",
              background: "var(--surface-2)",
              border: "3px solid var(--line)",
              boxShadow: "var(--shadow-sm)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span>
              TIMEFRAME: <strong>{startsAt || "—"}</strong> TO <strong>{endsAt || "—"}</strong>
            </span>
            <span
              style={{
                fontWeight: 900,
                color: daysLeft > 0 ? "var(--fg)" : "var(--coral)",
              }}
            >
              {daysLeft > 0
                ? `● ${daysLeft} DAY${daysLeft === 1 ? "" : "S"} LEFT`
                : daysLeft === 0
                ? "● FINAL DAY OF SPRINT"
                : `⚠ ENDED ${Math.abs(daysLeft)} DAY${Math.abs(daysLeft) === 1 ? "" : "S"} AGO`}
            </span>
          </div>
        </div>

        <div className="dialog-foot">
          <button className="btn-chunk btn-ghost" onClick={close} disabled={saving}>
            Cancel
          </button>
          <button className="btn-chunk btn-go" onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Save Sprint"}
          </button>
        </div>
      </div>
    </div>
  );
}
