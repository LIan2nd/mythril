"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const { user, sessionStatus, refreshSession } = useBoard();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState("lav");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [avatarTs, setAvatarTs] = useState(() => Date.now());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionStatus === "anon") router.push("/login");
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

  const saveIdentity = async () => {
    setBusy(true);
    setNote(null);
    try {
      await api.profile.update({ username: username.trim(), displayName: displayName.trim(), color });
      await refreshSession();
      setNote("Profile saved");
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    if (next !== confirm || next.length < 8) {
      setNote("New passwords must match (8+ chars)");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await api.profile.password({ currentPassword: cur, newPassword: next });
      setCur("");
      setNext("");
      setConfirm("");
      setNote("Password changed");
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Password change failed");
    } finally {
      setBusy(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setBusy(true);
    setNote(null);
    try {
      await api.profile.avatar(file);
      await refreshSession();
      setAvatarTs(Date.now());
      setNote("Avatar updated");
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const removeAvatar = async () => {
    setBusy(true);
    setNote(null);
    try {
      await api.profile.removeAvatar();
      await refreshSession();
      setAvatarTs(Date.now());
      setNote("Avatar removed");
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Remove failed");
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
        {note ? (
          <div className="toast" role="status">
            {note}{" "}
            <button aria-label="Dismiss note" onClick={() => setNote(null)} style={{ background: "transparent", border: 0, fontWeight: 900 }}>
              ✕
            </button>
          </div>
        ) : null}
        <div className="profile-grid">
          <section className="card" aria-label="Identity">
            <h2>Identity</h2>
            <div className="field">
              <label htmlFor="pfUser">Username</label>
              <input className="input" id="pfUser" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pfName">Display name</label>
              <input className="input" id="pfName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
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
            <button className="btn-chunk btn-go" disabled={!dirty || busy} onClick={saveIdentity}>
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
              <input className="input" id="pfCur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pfNext">New password</label>
              <input className="input" id="pfNext" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pfConfirm">Confirm new password</label>
              <input className="input" id="pfConfirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <button className="btn-chunk btn-go" onClick={changePassword} disabled={busy}>
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
