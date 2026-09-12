"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "../../lib/api";
import { BoardProvider, useBoard } from "../../lib/store";

function LoginCard() {
  const router = useRouter();
  const { login } = useBoard();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password, remember);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed");
      setBusy(false);
    }
  };

  return (
    <main className="auth-wrap">
      <form className="auth-card" onSubmit={submit} aria-label="Sign in">
        <div className="auth-logo">
          <span className="logo-mark">M</span>
          <span>MYTHRIL</span>
        </div>
        <h1>Sign in</h1>
        {error ? (
          <div className="auth-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="loginUser">Username</label>
          <input
            className="input"
            id="loginUser"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="loginPass">Password</label>
          <input
            className="input"
            id="loginPass"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="button"
          className="toggle"
          aria-pressed={remember}
          onClick={() => setRemember((v) => !v)}
          aria-label="Remember me"
        >
          <span className="sw" aria-hidden="true" />
          Remember me
        </button>
        <button className="btn-chunk btn-new" type="submit" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
        <p className="auth-link">
          No account? <Link href="/register">Request access</Link>
        </p>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <BoardProvider>
      <LoginCard />
    </BoardProvider>
  );
}
