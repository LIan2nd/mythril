"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ApiError } from "../../lib/api";
import { sanitizeNext } from "../../lib/sanitize-next";
import { BoardProvider, useBoard } from "../../lib/store";

function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, sessionStatus } = useBoard();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const isFieldTouched = (field: string) => submitted || !!touched[field];
  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const target = sanitizeNext(searchParams.get("next"));

  const uErr = !username.trim() ? "Username is required" : null;
  const pErr = !password ? "Password is required" : null;

  useEffect(() => {
    if (sessionStatus === "authed") {
      router.replace(target);
    }
  }, [sessionStatus, router, target]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (uErr || pErr || busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password, remember);
      router.replace(target);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed");
      setBusy(false);
    }
  };

  return (
    <main className="auth-wrap">
      <form className="auth-card" onSubmit={submit} aria-label="Sign in" noValidate>
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
            className={`input${isFieldTouched("username") && uErr ? " input-error" : ""}`}
            id="loginUser"
            autoComplete="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null);
            }}
            onBlur={() => markTouched("username")}
          />
          {isFieldTouched("username") && uErr ? <span className="auth-field-err">{uErr}</span> : null}
        </div>
        <div className="field">
          <label htmlFor="loginPass">Password</label>
          <input
            className={`input${isFieldTouched("password") && pErr ? " input-error" : ""}`}
            id="loginPass"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            onBlur={() => markTouched("password")}
          />
          {isFieldTouched("password") && pErr ? <span className="auth-field-err">{pErr}</span> : null}
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
        <button className="btn-chunk btn-new" type="submit" disabled={busy || (submitted && (!!uErr || !!pErr))}>
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
      <Suspense fallback={<div className="empty" style={{ padding: 48 }}>LOADING…</div>}>
        <LoginCard />
      </Suspense>
    </BoardProvider>
  );
}

