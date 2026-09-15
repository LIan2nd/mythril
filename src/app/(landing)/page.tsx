"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

const THEME_KEY = "mythril-theme";

function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      const isDark =
        saved === "dark" ||
        (saved == null && document.documentElement.dataset.theme === "dark");
      setDark(isDark);
    } catch {
      setDark(document.documentElement.dataset.theme === "dark");
    }
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.dataset.theme = next ? "dark" : "light";
      try {
        localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { dark, toggle };
}

const FEATURES = [
  {
    icon: "▦",
    title: "Kanban Board",
    desc: "Drag & drop cards, keyboard shortcuts, and real-time status updates across custom stages.",
    color: "var(--yellow)",
  },
  {
    icon: "⟳",
    title: "Sprint Management",
    desc: "Configurable sprint durations, date pickers, goals, and live health metrics on every board.",
    color: "var(--mint)",
  },
  {
    icon: "◈",
    title: "Multi-Project",
    desc: "Switch between projects instantly. Active selection persists across pages and reloads.",
    color: "var(--sky)",
  },
  {
    icon: "⛊",
    title: "RBAC & Admin",
    desc: "Role-based access control, user approvals, roster management, and cascade safety guards.",
    color: "var(--coral)",
  },
  {
    icon: "⬡",
    title: "Stage Control",
    desc: "Reorder, create, edit, and delete columns directly on the board. No admin panel required.",
    color: "var(--lav)",
  },
  {
    icon: "◐",
    title: "Dark Mode",
    desc: "Full dark/light theme support with instant toggle. Persists across sessions automatically.",
    color: "var(--yellow)",
  },
];

const TECH = [
  { name: "Next.js 15", accent: "var(--fg)" },
  { name: "React 19", accent: "var(--sky)" },
  { name: "TypeScript", accent: "var(--sky)" },
  { name: "PostgreSQL", accent: "var(--mint)" },
  { name: "Vitest", accent: "var(--lav)" },
];

export default function LandingPage() {
  const { dark, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className="landing">
      {/* ── Nav ── */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link href="/" className="logo" aria-label="Mythril">
            <span className="logo-mark">M</span> MYTHRIL
          </Link>
          <div className="landing-nav-actions">
            <button
              type="button"
              className="landing-theme-toggle"
              onClick={toggle}
              aria-label={mounted && dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {mounted ? (dark ? "☀" : "◑") : "◑"}
            </button>
            <Link href="/login" className="landing-btn landing-btn-ghost">
              Sign In
            </Link>
            <Link href="/register" className="landing-btn landing-btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-badge">NEO-BRUTALIST SPRINT KANBAN</div>
          <h1 className="landing-hero-title">
            Hard Shadows.<br />
            Zero Fluff.<br />
            <span className="landing-hero-accent">Ship Faster.</span>
          </h1>
          <p className="landing-hero-sub">
            A high-velocity project management dashboard built for developers who value
            clarity over clutter. 3px borders. Keyboard-first. Unapologetically bold.
          </p>
          <div className="landing-hero-cta">
            <Link href="/register" className="landing-btn landing-btn-primary landing-btn-lg">
              Get Started — Free
            </Link>
            <Link href="/login" className="landing-btn landing-btn-ghost landing-btn-lg">
              Sign In →
            </Link>
          </div>

          {/* ── Floating preview card ── */}
          <div className="landing-preview" aria-hidden="true">
            <div className="landing-preview-bar">
              <span className="landing-preview-dot" style={{ background: "var(--coral)" }} />
              <span className="landing-preview-dot" style={{ background: "var(--yellow)" }} />
              <span className="landing-preview-dot" style={{ background: "var(--mint)" }} />
              <span className="landing-preview-title">MYTHRIL BOARD</span>
            </div>
            <div className="landing-preview-cols">
              {["BACKLOG", "IN PROGRESS", "REVIEW", "DONE"].map((col) => (
                <div key={col} className="landing-preview-col">
                  <div className="landing-preview-col-head">{col}</div>
                  {Array.from({ length: col === "IN PROGRESS" ? 3 : col === "DONE" ? 1 : 2 }).map((_, i) => (
                    <div key={i} className="landing-preview-card">
                      <div className="landing-preview-card-line" style={{ width: `${60 + Math.random() * 35}%` }} />
                      <div className="landing-preview-card-line short" style={{ width: `${30 + Math.random() * 30}%` }} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-section" id="features">
        <div className="landing-section-inner">
          <div className="landing-section-badge">CAPABILITIES</div>
          <h2 className="landing-section-title">Everything you need,<br />nothing you don&apos;t.</h2>
          <div className="landing-features">
            {FEATURES.map((f) => (
              <div key={f.title} className="landing-feature-card">
                <div className="landing-feature-icon" style={{ background: f.color }}>
                  {f.icon}
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section className="landing-section landing-section-alt" id="stack">
        <div className="landing-section-inner">
          <div className="landing-section-badge">TECH STACK</div>
          <h2 className="landing-section-title">Built with modern tools.</h2>
          <div className="landing-tech">
            {TECH.map((t) => (
              <div
                key={t.name}
                className="landing-tech-badge"
                style={{ borderColor: t.accent }}
              >
                {t.name}
              </div>
            ))}
          </div>
          <p className="landing-tech-sub">
            Edge-ready authentication with scrypt + HMAC session cookies. Full Supabase
            compatibility. 60+ unit & integration tests with Vitest.
          </p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="landing-section landing-cta-section">
        <div className="landing-section-inner">
          <h2 className="landing-cta-title">Ready to ship?</h2>
          <p className="landing-cta-sub">
            No credit card. No setup wizard. Just a board and your backlog.
          </p>
          <div className="landing-hero-cta">
            <Link href="/register" className="landing-btn landing-btn-primary landing-btn-lg">
              Create Account
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="logo-mark" style={{ width: 28, height: 28, fontSize: 14 }}>M</span>
            <span>MYTHRIL</span>
          </div>
          <div className="landing-footer-links">
            <Link href="/login">Sign In</Link>
            <Link href="/register">Register</Link>
            <a href="https://github.com/LIan2nd/mythril" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
          <p className="landing-footer-copy">© {new Date().getFullYear()} MYTHRIL · ● SYSTEM ONLINE</p>
        </div>
      </footer>
    </div>
  );
}
