"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Toast } from "../../components/Toast";
import { Topbar } from "../../components/Topbar";
import { ApiError, api, avatarSrc } from "../../lib/api";
import { BoardProvider, useBoard } from "../../lib/store";

const COLORS = ["lav", "yellow", "coral", "mint", "sky"];

function colorVar(c: string): string {
  if (c === "lavender") return "var(--lav)";
  if (c === "yellow") return "var(--yellow)";
  if (c === "coral") return "var(--coral)";
  if (c === "mint") return "var(--mint)";
  if (c === "sky") return "var(--sky)";
  return COLORS.includes(c) ? `var(--${c})` : c;
}

function ProfilePage() {
  const router = useRouter();
  const { user, sessionStatus, refreshSession, showToast } = useBoard();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState("lav");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [identityTouched, setIdentityTouched] = useState<Record<string, boolean>>({});
  const [identitySubmitted, setIdentitySubmitted] = useState(false);
  const showIdentityErr = (f: string) => identitySubmitted || !!identityTouched[f];
  const markIdentityTouched = (f: string) => setIdentityTouched((prev) => ({ ...prev, [f]: true }));

  const [securityTouched, setSecurityTouched] = useState<Record<string, boolean>>({});
  const [securitySubmitted, setSecuritySubmitted] = useState(false);
  const showSecurityErr = (f: string) => securitySubmitted || !!securityTouched[f];
  const markSecurityTouched = (f: string) => setSecurityTouched((prev) => ({ ...prev, [f]: true }));

  const [avatarTs, setAvatarTs] = useState(() => Date.now());
  const fileRef = useRef<HTMLInputElement>(null);

  const setNote = useCallback(
    (msg: string | null) => {
      if (msg) showToast(msg, "error");
    },
    [showToast],
  );

  useEffect(() => {
    if (sessionStatus === "anon") router.push("/login?next=/profile");
  }, [sessionStatus, router]);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setDisplayName(user.displayName);
      setColor(user.color);
    }
  }, [user]);

  if (sessionStatus === "loading") {
    return (
      <main className="wrap">
        <div className="skel" aria-label="Checking session">
          <i className="short" />
          <i />
          <i />
        </div>
      </main>
    );
  }
  if (!user) return null;

  const dirty =
    username.trim() !== user.username || displayName.trim() !== user.displayName || color !== user.color;

  const usernameErr = !username.trim()
    ? "Username is required"
    : !/^[a-z0-9._-]{2,32}$/.test(username.trim())
    ? "2-32 chars (lowercase letters, digits, dot, dash, underscore)"
    : null;
  const displayNameErr = !displayName.trim()
    ? "Display name is required"
    : displayName.trim().length < 2 || displayName.trim().length > 60
    ? "Must be 2-60 characters"
    : null;
  const identityValid = !usernameErr && !displayNameErr;

  const curErr = !cur ? "Current password is required" : null;
  const nextErr = !next ? "New password is required" : next.length < 8 ? "Must be at least 8 characters" : null;
  const confirmErr = !confirm ? "Please confirm password" : confirm !== next ? "Passwords must match" : null;
  const securityValid = !curErr && !nextErr && !confirmErr;

  const saveIdentity = async () => {
    setIdentitySubmitted(true);
    if (!dirty || !identityValid || busy) return;
    setBusy(true);
    try {
      await api.profile.update({ username: username.trim(), displayName: displayName.trim(), color });
      await refreshSession();
      showToast("Profile saved successfully", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    setSecuritySubmitted(true);
    if (!securityValid || busy) {
      if (next !== confirm || next.length < 8) {
        showToast("New passwords must match (8+ chars)", "error");
      }
      return;
    }
    setBusy(true);
    try {
      await api.profile.password({ currentPassword: cur, newPassword: next });
      setCur("");
      setNext("");
      setConfirm("");
      setSecurityTouched({});
      setSecuritySubmitted(false);
      showToast("Password changed successfully", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Password change failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setBusy(true);
    try {
      await api.profile.avatar(file);
      await refreshSession();
      setAvatarTs(Date.now());
      showToast("Avatar updated successfully", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Upload failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeAvatar = async () => {
    setBusy(true);
    try {
      await api.profile.removeAvatar();
      await refreshSession();
      setAvatarTs(Date.now());
      showToast("Avatar removed successfully", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Remove failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Topbar />
      <main className="wrap" id="content">
        <p className="kicker">
          <Link href="/">Board</Link> / Profile
        </p>
        <div className="profile-grid">
          <section className="card" aria-label="Identity">
            <h2>Identity</h2>
            <div className="field">
              <label htmlFor="pfUser">Username</label>
              <input
                className={`input${showIdentityErr("username") && usernameErr ? " input-error" : ""}`}
                id="pfUser"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setNote(null);
                }}
                onBlur={() => markIdentityTouched("username")}
              />
              {showIdentityErr("username") && usernameErr && <span className="field-error-msg">{usernameErr}</span>}
            </div>
            <div className="field">
              <label htmlFor="pfName">Display name</label>
              <input
                className={`input${showIdentityErr("displayName") && displayNameErr ? " input-error" : ""}`}
                id="pfName"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setNote(null);
                }}
                onBlur={() => markIdentityTouched("displayName")}
              />
              {showIdentityErr("displayName") && displayNameErr && <span className="field-error-msg">{displayNameErr}</span>}
            </div>
            <div className="field">
              <span className="kicker">Color</span>
              <div className="chip-row" role="radiogroup" aria-label="Avatar color">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={c}
                    className={`cbox color-chip${color === c ? " selected" : ""}`}
                    style={{ background: colorVar(c) }}
                    onClick={() => setColor(c)}
                  >
                    {color === c ? "✓" : ""}
                  </button>
                ))}
              </div>
              <span className="who">
                <span className="avatar" style={{ background: colorVar(color) }}>
                  {user.code ?? user.username.slice(0, 2).toUpperCase()}
                </span>
                Preview
              </span>
            </div>
            <button className="btn-chunk btn-go" disabled={!dirty || (identitySubmitted && !identityValid) || busy} onClick={saveIdentity}>
              {busy ? "Saving..." : "Save profile"}
            </button>
          </section>
          <section className="card" aria-label="Avatar">
            <h2>Avatar</h2>
            <span className="avatar avatar-lg" style={{ background: colorVar(user.color) }}>
              {user.hasAvatar && user.code ? (
                <img src={avatarSrc(user.code, avatarTs)} alt={`${user.displayName} avatar`} />
              ) : (
                (user.code ?? user.username.slice(0, 2).toUpperCase())
              )}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="avatar-file"
              aria-label="Upload avatar"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAvatar(f);
                e.target.value = "";
              }}
            />
            <div className="btn-row">
              <button className="btn-chunk btn-new" onClick={() => fileRef.current?.click()} disabled={busy}>
                Upload
              </button>
              {user.hasAvatar ? (
                <button className="btn-chunk btn-ghost" onClick={removeAvatar} disabled={busy}>
                  Remove
                </button>
              ) : null}
            </div>
          </section>
          <section className="card" aria-label="Security">
            <h2>Security</h2>
            <div className="field">
              <label htmlFor="pfCur">Current password</label>
              <input
                className={`input${showSecurityErr("cur") && curErr ? " input-error" : ""}`}
                id="pfCur"
                type="password"
                autoComplete="current-password"
                value={cur}
                onChange={(e) => {
                  setCur(e.target.value);
                  setNote(null);
                }}
                onBlur={() => markSecurityTouched("cur")}
              />
              {showSecurityErr("cur") && curErr && <span className="field-error-msg">{curErr}</span>}
            </div>
            <div className="field">
              <label htmlFor="pfNext">New password</label>
              <input
                className={`input${showSecurityErr("next") && nextErr ? " input-error" : ""}`}
                id="pfNext"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => {
                  setNext(e.target.value);
                  setNote(null);
                }}
                onBlur={() => markSecurityTouched("next")}
              />
              {showSecurityErr("next") && nextErr && <span className="field-error-msg">{nextErr}</span>}
            </div>
            <div className="field">
              <label htmlFor="pfConfirm">Confirm new password</label>
              <input
                className={`input${showSecurityErr("confirm") && confirmErr ? " input-error" : ""}`}
                id="pfConfirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setNote(null);
                }}
                onBlur={() => markSecurityTouched("confirm")}
              />
              {showSecurityErr("confirm") && confirmErr && <span className="field-error-msg">{confirmErr}</span>}
            </div>
            <button className="btn-chunk btn-go" onClick={changePassword} disabled={busy || (securitySubmitted && !securityValid)}>
              Change password
            </button>
          </section>
        </div>
      </main>
      <Toast />
    </>
  );
}


export default function ProfilePageRoute() {
  return (
    <BoardProvider>
      <ProfilePage />
    </BoardProvider>
  );
}
