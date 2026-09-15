"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, api } from "../../lib/api";

function fieldError(v: string, re: RegExp, msg: string): string | null {
  if (!v) return "Required";
  return re.test(v) ? null : msg;
}

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const isFieldTouched = (field: string) => submitted || !!touched[field];
  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const uErr = fieldError(username.trim(), /^[a-z0-9._-]{3,32}$/, "3-32 chars: a-z 0-9 . _ -");
  const nErr = displayName.trim().length >= 2 && displayName.trim().length <= 60 ? null : "2-60 chars";
  const pErr = password.length >= 8 && password.length <= 72 ? null : "8-72 chars";
  const cErr = confirm === password && confirm.length > 0 ? null : "Passwords must match";
  const valid = !uErr && !nErr && !pErr && !cErr;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.auth.register({ username: username.trim(), displayName: displayName.trim(), password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed");
      setBusy(false);
    }
  };

  if (done) {
    return (
      <main className="auth-wrap">
        <div className="auth-card" role="status">
          <Link href="/" className="auth-logo">
            <span className="logo-mark">M</span>
            <span>MYTHRIL</span>
          </Link>
          <h1>Account requested</h1>
          <p className="auth-note">An admin needs to approve it before you can sign in.</p>
          <Link className="btn-chunk btn-new" href="/login">
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-wrap">
      <form className="auth-card" onSubmit={submit} aria-label="Request access" noValidate>
        <Link href="/" className="auth-logo">
          <span className="logo-mark">M</span>
          <span>MYTHRIL</span>
        </Link>
        <h1>Request access</h1>
        {error ? (
          <div className="auth-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="regUser">Username</label>
          <input
            className={`input${isFieldTouched("username") && uErr ? " input-error" : ""}`}
            id="regUser"
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
          <label htmlFor="regName">Display name</label>
          <input
            className={`input${isFieldTouched("displayName") && nErr ? " input-error" : ""}`}
            id="regName"
            autoComplete="name"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setError(null);
            }}
            onBlur={() => markTouched("displayName")}
          />
          {isFieldTouched("displayName") && nErr ? <span className="auth-field-err">{nErr}</span> : null}
        </div>
        <div className="field">
          <label htmlFor="regPass">Password</label>
          <input
            className={`input${isFieldTouched("password") && pErr ? " input-error" : ""}`}
            id="regPass"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            onBlur={() => markTouched("password")}
          />
          {isFieldTouched("password") && pErr ? <span className="auth-field-err">{pErr}</span> : null}
        </div>
        <div className="field">
          <label htmlFor="regConfirm">Confirm password</label>
          <input
            className={`input${isFieldTouched("confirm") && cErr ? " input-error" : ""}`}
            id="regConfirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setError(null);
            }}
            onBlur={() => markTouched("confirm")}
          />
          {isFieldTouched("confirm") && cErr ? <span className="auth-field-err">{cErr}</span> : null}
        </div>
        <button className="btn-chunk btn-new" type="submit" disabled={busy || (submitted && !valid)}>
          {busy ? "Submitting..." : "Request access"}
        </button>
        <p className="auth-link">
          Have an account? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
