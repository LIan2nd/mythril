"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Toast } from "../../components/Toast";
import { Topbar } from "../../components/Topbar";
import type {
  AdminProjectDetail,
  AdminUserDetail,
  BoardColumn,
  ColumnColor,
  ColumnKind,
  Role,
  UserStatus,
} from "../../domain/types";
import { COLUMN_COLORS, COLUMN_KINDS } from "../../domain/types";
import { ApiError, api, avatarSrc } from "../../lib/api";
import { BoardProvider, useBoard } from "../../lib/store";

type Tab = "users" | "requests" | "projects" | "columns";

const TABS: { key: Tab; label: string }[] = [
  { key: "users", label: "Users" },
  { key: "requests", label: "Requests" },
  { key: "projects", label: "Projects" },
  { key: "columns", label: "Columns" },
];

function slugify(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  let out = "";
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  for (const n of buf) out += chars[n % chars.length];
  return out;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="btn-chunk btn-ghost" style={{ padding: "6px 12px", boxShadow: "none" }} onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}

function AdminPage() {
  const router = useRouter();
  const { user, sessionStatus, refreshSession } = useBoard();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUserDetail[]>([]);
  const [projects, setProjects] = useState<AdminProjectDetail[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUserDetail | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [renameProject, setRenameProject] = useState<AdminProjectDetail | null>(null);
  const [deleteProjectKey, setDeleteProjectKey] = useState<string | null>(null);
  const [memberEditor, setMemberEditor] = useState<AdminProjectDetail | null>(null);
  const [renameColumn, setRenameColumn] = useState<BoardColumn | null>(null);
  const [deleteColumnKey, setDeleteColumnKey] = useState<string | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);

  const pending = useMemo(() => users.filter((u) => u.status === "pending"), [users]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([api.admin.listUsers(), api.admin.listProjects()]);
      setUsers(u);
      setProjects(p);
      if (p[0]) {
        try {
          const b = await api.getBoard(p[0].key);
          setColumns(b.columns);
        } catch {
          setColumns([]);
        }
      }
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Admin load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "anon") router.push("/");
  }, [sessionStatus, router]);

  useEffect(() => {
    if (sessionStatus === "authed" && !user) void refreshSession();
  }, [sessionStatus, user, refreshSession]);

  useEffect(() => {
    if (user && user.role !== "admin") router.push("/");
  }, [user, router]);

  useEffect(() => {
    if (user?.role === "admin") void load();
  }, [user, load]);

  const mutateUsers = async (fn: () => Promise<unknown>, fail: string) => {
    try {
      await fn();
      const u = await api.admin.listUsers();
      setUsers(u);
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : fail);
    }
  };

  const setRole = (u: AdminUserDetail, role: Role) => {
    const prev = users;
    setUsers(prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
    api.admin.updateUser(u.id, { role }).catch((err: unknown) => {
      setUsers(prev);
      setNote(err instanceof ApiError ? err.message : "Role update failed");
    });
  };

  const setStatus = (u: AdminUserDetail, status: UserStatus) =>
    mutateUsers(() => api.admin.updateUser(u.id, { status }), "Status update failed");

  const approveWithRole = (u: AdminUserDetail, role: Role) =>
    mutateUsers(() => api.admin.updateUser(u.id, { status: "active", role }), "Approve failed");

  const doResetPassword = async () => {
    if (!resetTarget || !resetPw) return;
    try {
      await api.admin.updateUser(resetTarget.id, { password: resetPw });
      setResetTarget(null);
      setResetPw("");
      setNote("Password reset");
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Reset failed");
    }
  };

  const doDeleteUser = async () => {
    if (deleteUserId == null) return;
    try {
      await api.admin.deleteUser(deleteUserId);
      setDeleteUserId(null);
      const u = await api.admin.listUsers();
      setUsers(u);
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Delete failed");
    }
  };

  if (sessionStatus === "loading" || !user) {
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
  if (user.role !== "admin") return null;

  return (
    <>
      <Topbar />
      <main className="wrap" id="content">
        <p className="kicker">
          <Link href="/">Board</Link> / Admin
        </p>
        <h1>Admin panel</h1>
        <div className="adm-tabs" role="tablist" aria-label="Admin sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className="toggle"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              <span className="sw" aria-hidden="true" />
              {t.label}
              {t.key === "requests" && pending.length ? <span className="count num">{pending.length}</span> : null}
            </button>
          ))}
        </div>
        {note ? (
          <div className="toast" role="status">
            {note}{" "}
            <button aria-label="Dismiss note" onClick={() => setNote(null)} style={{ background: "transparent", border: 0, fontWeight: 900 }}>
              ✕
            </button>
          </div>
        ) : null}
        {loading ? (
          <div className="skel" aria-label="Loading admin data">
            <i className="short" />
            <i />
            <i />
            <i />
          </div>
        ) : tab === "users" ? (
          <UsersTab
            users={users.filter((u) => u.status !== "pending")}
            onRole={setRole}
            onStatus={setStatus}
            onReset={(u) => { setResetTarget(u); setResetPw(randomPassword()); }}
            onDelete={(id) => setDeleteUserId(id)}
            onCreate={() => setCreateUserOpen(true)}
          />
        ) : tab === "requests" ? (
          <RequestsTab users={pending} onApprove={approveWithRole} onReject={(u) => setStatus(u, "rejected")} />
        ) : tab === "projects" ? (
          <ProjectsTab
            projects={projects}
            users={users.filter((u) => u.status === "active")}
            setProjects={setProjects}
            setNote={setNote}
            onCreate={() => setCreateProjectOpen(true)}
            onRename={setRenameProject}
            onDelete={setDeleteProjectKey}
            onMembers={setMemberEditor}
          />
        ) : (
          <ColumnsTab
            columns={columns}
            setColumns={setColumns}
            setNote={setNote}
            onAdd={() => setAddColumnOpen(true)}
            onRename={setRenameColumn}
            onDelete={setDeleteColumnKey}
          />
        )}
      </main>
      {resetTarget ? (
        <Modal title={`Reset password — ${resetTarget.username}`} onClose={() => setResetTarget(null)}>
          <div className="field">
            <label htmlFor="resetPw">New password</label>
            <input className="input" id="resetPw" value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
          </div>
          <div className="dialog-foot">
            <button className="btn-chunk btn-ghost" onClick={() => setResetPw(randomPassword())}>
              Random
            </button>
            <button
              className="btn-chunk btn-ghost"
              onClick={() => { void navigator.clipboard?.writeText(resetPw).catch(() => undefined); }}
            >
              Copy
            </button>
            <button className="btn-chunk btn-go" onClick={doResetPassword}>
              Save
            </button>
          </div>
        </Modal>
      ) : null}
      {deleteUserId != null ? (
        <Modal title="Delete user" onClose={() => setDeleteUserId(null)}>
          <p className="auth-note">Delete this user? Blocked if issues are assigned to them.</p>
          <div className="dialog-foot">
            <button className="btn-chunk btn-ghost" onClick={() => setDeleteUserId(null)}>
              Cancel
            </button>
            <button className="btn-chunk btn-new" onClick={doDeleteUser}>
              Delete
            </button>
          </div>
        </Modal>
      ) : null}
      {createUserOpen ? (
        <CreateUserModal
          onClose={() => setCreateUserOpen(false)}
          onDone={async () => { setCreateUserOpen(false); const u = await api.admin.listUsers(); setUsers(u); }}
          onError={setNote}
        />
      ) : null}
      {createProjectOpen ? (
        <CreateProjectModal
          onClose={() => setCreateProjectOpen(false)}
          onDone={(p) => { setCreateProjectOpen(false); setProjects((prev) => [...prev, p]); }}
          onError={setNote}
        />
      ) : null}
      {renameProject ? (
        <RenameProjectModal
          project={renameProject}
          onClose={() => setRenameProject(null)}
          onDone={(p) => { setRenameProject(null); setProjects((prev) => prev.map((x) => (x.key === renameProject.key ? p : x))); }}
          onError={setNote}
        />
      ) : null}
      {deleteProjectKey ? (
        <Modal title="Delete project" onClose={() => setDeleteProjectKey(null)}>
          <p className="auth-note">Delete {deleteProjectKey}? Blocked when it has issues.</p>
          <div className="dialog-foot">
            <button className="btn-chunk btn-ghost" onClick={() => setDeleteProjectKey(null)}>
              Cancel
            </button>
            <button
              className="btn-chunk btn-new"
              onClick={async () => {
                try {
                  await api.admin.deleteProject(deleteProjectKey);
                  setProjects((prev) => prev.filter((x) => x.key !== deleteProjectKey));
                  setDeleteProjectKey(null);
                } catch (err) {
                  setNote(err instanceof ApiError ? err.message : "Delete failed");
                }
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      ) : null}
      {memberEditor ? (
        <MembersModal
          project={memberEditor}
          users={users.filter((u) => u.status === "active")}
          onClose={() => setMemberEditor(null)}
          onDone={(p) => { setMemberEditor(null); setProjects((prev) => prev.map((x) => (x.key === p.key ? p : x))); }}
          onError={setNote}
        />
      ) : null}
      {addColumnOpen ? (
        <AddColumnModal
          onClose={() => setAddColumnOpen(false)}
          onDone={(c) => { setAddColumnOpen(false); setColumns((prev) => [...prev, c]); }}
          onError={setNote}
        />
      ) : null}
      {renameColumn ? (
        <RenameColumnModal
          column={renameColumn}
          onClose={() => setRenameColumn(null)}
          onDone={(c) => { setRenameColumn(null); setColumns((prev) => prev.map((x) => (x.key === c.key ? c : x))); }}
          onError={setNote}
        />
      ) : null}
      {deleteColumnKey ? (
        <Modal title="Delete column" onClose={() => setDeleteColumnKey(null)}>
          <p className="auth-note">Delete {deleteColumnKey}? Blocked when issues live there.</p>
          <div className="dialog-foot">
            <button className="btn-chunk btn-ghost" onClick={() => setDeleteColumnKey(null)}>
              Cancel
            </button>
            <button
              className="btn-chunk btn-new"
              onClick={async () => {
                try {
                  await api.admin.deleteColumn(deleteColumnKey);
                  setColumns((prev) => prev.filter((x) => x.key !== deleteColumnKey));
                  setDeleteColumnKey(null);
                } catch (err) {
                  setNote(err instanceof ApiError ? err.message : "Delete failed");
                }
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      ) : null}
      <Toast />
    </>
  );
}

function UserRow({
  u,
  onRole,
  onStatus,
  onReset,
  onDelete,
}: {
  u: AdminUserDetail;
  onRole: (u: AdminUserDetail, role: Role) => void;
  onStatus: (u: AdminUserDetail, s: UserStatus) => void;
  onReset: (u: AdminUserDetail) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <li className="adm-row">
      <span className="avatar" aria-hidden="true">
        {u.hasAvatar && u.code ? <img src={avatarSrc(u.code)} alt="" /> : (u.code ?? u.username.slice(0, 2).toUpperCase())}
      </span>
      <span className="adm-id">
        <strong>{u.username}</strong>
        <span className="kicker">{u.displayName}</span>
      </span>
      <select
        className="select adm-select"
        aria-label={`Role for ${u.username}`}
        value={u.role}
        onChange={(e) => onRole(u, e.target.value as Role)}
      >
        <option value="member">member</option>
        <option value="admin">admin</option>
      </select>
      <span className={`badge ${u.status === "active" ? "b-done" : u.status === "pending" ? "b-med" : "b-high"}`}>
        {u.status}
      </span>
      <span className="adm-actions">
        {u.status === "active" ? (
          <button className="btn-chunk btn-ghost adm-btn" onClick={() => onStatus(u, "disabled")}>
            Disable
          </button>
        ) : u.status === "disabled" ? (
          <button className="btn-chunk btn-ghost adm-btn" onClick={() => onStatus(u, "active")}>
            Enable
          </button>
        ) : null}
        <button className="btn-chunk btn-ghost adm-btn" onClick={() => onReset(u)}>
          Reset pw
        </button>
        <button className="btn-chunk btn-ghost adm-btn" onClick={() => onDelete(u.id)} aria-label={`Delete ${u.username}`}>
          ✕
        </button>
      </span>
    </li>
  );
}

function UsersTab(props: {
  users: AdminUserDetail[];
  onRole: (u: AdminUserDetail, r: Role) => void;
  onStatus: (u: AdminUserDetail, s: UserStatus) => void;
  onReset: (u: AdminUserDetail) => void;
  onDelete: (id: number) => void;
  onCreate: () => void;
}) {
  return (
    <section aria-label="Users">
      <div className="btn-row">
        <button className="btn-chunk btn-new" onClick={props.onCreate}>
          + Add user
        </button>
      </div>
      <ul className="adm-list">
        {props.users.map((u) => (
          <UserRow key={u.id} u={u} onRole={props.onRole} onStatus={props.onStatus} onReset={props.onReset} onDelete={props.onDelete} />
        ))}
      </ul>
      {props.users.length === 0 ? <div className="empty">No users</div> : null}
    </section>
  );
}

function RequestsTab(props: {
  users: AdminUserDetail[];
  onApprove: (u: AdminUserDetail, r: Role) => void;
  onReject: (u: AdminUserDetail) => void;
}) {
  const [roles, setRoles] = useState<Record<number, Role>>({});
  if (props.users.length === 0) return <div className="empty">No access requests</div>;
  return (
    <ul className="adm-list" aria-label="Access requests">
      {props.users.map((u) => (
        <li key={u.id} className="adm-row">
          <span className="adm-id">
            <strong>{u.username}</strong>
            <span className="kicker">{u.displayName}</span>
          </span>
          <span className="badge b-med">pending</span>
          <select
            className="select adm-select"
            aria-label={`Approve role for ${u.username}`}
            value={roles[u.id] ?? "member"}
            onChange={(e) => setRoles((prev) => ({ ...prev, [u.id]: e.target.value as Role }))}
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
          <span className="adm-actions">
            <button className="btn-chunk btn-go adm-btn" onClick={() => props.onApprove(u, roles[u.id] ?? "member")}>
              Approve
            </button>
            <button className="btn-chunk btn-ghost adm-btn" onClick={() => props.onReject(u)}>
              Reject
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function ProjectsTab(props: {
  projects: AdminProjectDetail[];
  users: AdminUserDetail[];
  setProjects: React.Dispatch<React.SetStateAction<AdminProjectDetail[]>>;
  setNote: (m: string | null) => void;
  onCreate: () => void;
  onRename: (p: AdminProjectDetail) => void;
  onDelete: (k: string) => void;
  onMembers: (p: AdminProjectDetail) => void;
}) {
  return (
    <section aria-label="Projects">
      <div className="btn-row">
        <button className="btn-chunk btn-new" onClick={props.onCreate}>
          + Add project
        </button>
      </div>
      <ul className="adm-list">
        {props.projects.map((p) => (
          <li key={p.key} className="adm-row">
            <span className="adm-id">
              <strong>{p.key}</strong>
              <span className="kicker">{p.name}</span>
            </span>
            <span className="kicker">{p.issueCount} issues</span>
            <span className="chip-row">
              {p.members.slice(0, 6).map((m) => (
                <span key={m.code ?? m.id} className="avatar avatar-xs" title={m.displayName}>
                  {m.hasAvatar && m.code ? <img src={avatarSrc(m.code)} alt="" /> : (m.code ?? "?")}
                </span>
              ))}
            </span>
            <span className="adm-actions">
              <button className="btn-chunk btn-ghost adm-btn" onClick={() => props.onMembers(p)}>
                Members
              </button>
              <button className="btn-chunk btn-ghost adm-btn" onClick={() => props.onRename(p)}>
                Rename
              </button>
              <button className="btn-chunk btn-ghost adm-btn" onClick={() => props.onDelete(p.key)} aria-label={`Delete ${p.key}`}>
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ColumnsTab(props: {
  columns: BoardColumn[];
  setColumns: React.Dispatch<React.SetStateAction<BoardColumn[]>>;
  setNote: (m: string | null) => void;
  onAdd: () => void;
  onRename: (c: BoardColumn) => void;
  onDelete: (k: string) => void;
}) {
  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...props.columns];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[idx];
    next[idx] = next[j];
    next[j] = tmp;
    const prev = props.columns;
    props.setColumns(next);
    try {
      await api.admin.reorderColumns({ orderedKeys: next.map((c) => c.key) });
    } catch (err) {
      props.setColumns(prev);
      props.setNote(err instanceof ApiError ? err.message : "Reorder failed");
    }
  };

  const setKind = async (c: BoardColumn, kind: ColumnKind) => {
    const prev = props.columns;
    props.setColumns(prev.map((x) => (x.key === c.key ? { ...x, kind } : x)));
    try {
      const updated = await api.admin.updateColumn(c.key, { kind });
      props.setColumns((cur) => cur.map((x) => (x.key === c.key ? updated : x)));
    } catch (err) {
      props.setColumns(prev);
      props.setNote(err instanceof ApiError ? err.message : "Kind update failed");
    }
  };

  return (
    <section aria-label="Columns">
      <div className="btn-row">
        <button className="btn-chunk btn-new" onClick={props.onAdd}>
          + Add column
        </button>
      </div>
      <ul className="adm-list">
        {props.columns.map((c, idx) => (
          <li key={c.key} className="adm-row">
            <span className={`sq col-sq-${c.color}`} aria-hidden="true" />
            <span className="adm-id">
              <strong>{c.label}</strong>
              <span className="kicker">{c.key}</span>
            </span>
            <select
              className="select adm-select"
              aria-label={`Kind for ${c.label}`}
              value={c.kind}
              onChange={(e) => setKind(c, e.target.value as ColumnKind)}
            >
              {COLUMN_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <span className="adm-actions">
              <button className="btn-chunk btn-ghost adm-btn" aria-label={`Move ${c.label} left`} disabled={idx === 0} onClick={() => move(idx, -1)}>
                ←
              </button>
              <button className="btn-chunk btn-ghost adm-btn" aria-label={`Move ${c.label} right`} disabled={idx === props.columns.length - 1} onClick={() => move(idx, 1)}>
                →
              </button>
              <button className="btn-chunk btn-ghost adm-btn" onClick={() => props.onRename(c)}>
                Rename
              </button>
              <button className="btn-chunk btn-ghost adm-btn" onClick={() => props.onDelete(c.key)} aria-label={`Delete ${c.label}`}>
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CreateUserModal(props: { onClose: () => void; onDone: () => Promise<void>; onError: (m: string) => void }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("member");
  const submit = async () => {
    try {
      await api.admin.createUser({ username: username.trim(), displayName: displayName.trim(), password, role });
      await props.onDone();
    } catch (err) {
      props.onError(err instanceof ApiError ? err.message : "Create failed");
    }
  };
  return (
    <Modal title="Add user" onClose={props.onClose}>
      <div className="field">
        <label htmlFor="cuUser">Username</label>
        <input className="input" id="cuUser" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="cuName">Display name</label>
        <input className="input" id="cuName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="cuPass">Password</label>
        <input className="input" id="cuPass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="cuRole">Role</label>
        <select className="select" id="cuRole" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="member">member</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <div className="dialog-foot">
        <button className="btn-chunk btn-ghost" onClick={props.onClose}>
          Cancel
        </button>
        <button className="btn-chunk btn-go" onClick={submit}>
          Create
        </button>
      </div>
    </Modal>
  );
}

function CreateProjectModal(props: {
  onClose: () => void;
  onDone: (p: AdminProjectDetail) => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const submit = async () => {
    try {
      const p = await api.admin.createProject({ key: key.trim(), name: name.trim() });
      props.onDone(p);
    } catch (err) {
      props.onError(err instanceof ApiError ? err.message : "Create failed");
    }
  };
  return (
    <Modal title="Add project" onClose={props.onClose}>
      <div className="field">
        <label htmlFor="cpName">Name</label>
        <input
          className="input"
          id="cpName"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!keyTouched) setKey(slugify(e.target.value));
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="cpKey">Key</label>
        <input
          className="input"
          id="cpKey"
          value={key}
          onChange={(e) => { setKey(slugify(e.target.value)); setKeyTouched(true); }}
        />
      </div>
      <div className="dialog-foot">
        <button className="btn-chunk btn-ghost" onClick={props.onClose}>
          Cancel
        </button>
        <button className="btn-chunk btn-go" onClick={submit}>
          Create
        </button>
      </div>
    </Modal>
  );
}

function RenameProjectModal(props: {
  project: AdminProjectDetail;
  onClose: () => void;
  onDone: (p: AdminProjectDetail) => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(props.project.name);
  const submit = async () => {
    try {
      const p = await api.admin.updateProject(props.project.key, { name: name.trim() });
      props.onDone(p);
    } catch (err) {
      props.onError(err instanceof ApiError ? err.message : "Rename failed");
    }
  };
  return (
    <Modal title={`Rename ${props.project.key}`} onClose={props.onClose}>
      <div className="field">
        <label htmlFor="rpName">Name</label>
        <input className="input" id="rpName" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="dialog-foot">
        <button className="btn-chunk btn-ghost" onClick={props.onClose}>
          Cancel
        </button>
        <button className="btn-chunk btn-go" onClick={submit}>
          Save
        </button>
      </div>
    </Modal>
  );
}

function MembersModal(props: {
  project: AdminProjectDetail;
  users: AdminUserDetail[];
  onClose: () => void;
  onDone: (p: AdminProjectDetail) => void;
  onError: (m: string) => void;
}) {
  const [codes, setCodes] = useState<string[]>(props.project.members.map((m) => m.code).filter((c): c is string => !!c));
  const toggle = (code: string) =>
    setCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  const submit = async () => {
    try {
      const p = await api.admin.setMembers(props.project.key, { codes });
      props.onDone(p);
    } catch (err) {
      props.onError(err instanceof ApiError ? err.message : "Members update failed");
    }
  };
  return (
    <Modal title={`Members — ${props.project.key}`} onClose={props.onClose}>
      <div className="chip-row">
        {props.users.map((u) => (
          <button
            key={u.id}
            type="button"
            className="toggle"
            aria-pressed={u.code ? codes.includes(u.code) : false}
            onClick={() => u.code && toggle(u.code)}
          >
            <span className="sw" aria-hidden="true" />
            {u.username}
          </button>
        ))}
      </div>
      <div className="dialog-foot">
        <button className="btn-chunk btn-ghost" onClick={props.onClose}>
          Cancel
        </button>
        <button className="btn-chunk btn-go" onClick={submit}>
          Save
        </button>
      </div>
    </Modal>
  );
}

function AddColumnModal(props: { onClose: () => void; onDone: (c: BoardColumn) => void; onError: (m: string) => void }) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<ColumnKind>("active");
  const [color, setColor] = useState<ColumnColor>("sky");
  const submit = async () => {
    try {
      const c = await api.admin.createColumn({ label: label.trim(), kind, color });
      props.onDone(c);
    } catch (err) {
      props.onError(err instanceof ApiError ? err.message : "Create failed");
    }
  };
  return (
    <Modal title="Add column" onClose={props.onClose}>
      <div className="field">
        <label htmlFor="acLabel">Label</label>
        <input className="input" id="acLabel" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="field">
        <span className="kicker">Kind</span>
        <div className="chip-row" role="radiogroup" aria-label="Column kind">
          {COLUMN_KINDS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className="toggle" aria-pressed={kind === k} onClick={() => setKind(k)}>
              <span className="sw" aria-hidden="true" />
              {k}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="kicker">Color</span>
        <div className="chip-row" role="radiogroup" aria-label="Column color">
          {COLUMN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              className={`cbox color-chip${color === c ? " selected" : ""} col-sq-${c}`}
              onClick={() => setColor(c)}
            >
              {color === c ? "✓" : ""}
            </button>
          ))}
        </div>
      </div>
      <div className="dialog-foot">
        <button className="btn-chunk btn-ghost" onClick={props.onClose}>
          Cancel
        </button>
        <button className="btn-chunk btn-go" onClick={submit}>
          Create
        </button>
      </div>
    </Modal>
  );
}

function RenameColumnModal(props: {
  column: BoardColumn;
  onClose: () => void;
  onDone: (c: BoardColumn) => void;
  onError: (m: string) => void;
}) {
  const [label, setLabel] = useState(props.column.label);
  const submit = async () => {
    try {
      const c = await api.admin.updateColumn(props.column.key, { label: label.trim() });
      props.onDone(c);
    } catch (err) {
      props.onError(err instanceof ApiError ? err.message : "Rename failed");
    }
  };
  return (
    <Modal title={`Rename ${props.column.key}`} onClose={props.onClose}>
      <div className="field">
        <label htmlFor="rcLabel">Label</label>
        <input className="input" id="rcLabel" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="dialog-foot">
        <button className="btn-chunk btn-ghost" onClick={props.onClose}>
          Cancel
        </button>
        <button className="btn-chunk btn-go" onClick={submit}>
          Save
        </button>
      </div>
    </Modal>
  );
}


export default function AdminPageRoute() {
  return (
    <BoardProvider>
      <AdminPage />
    </BoardProvider>
  );
}
