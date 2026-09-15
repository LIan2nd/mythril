"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Toast } from "../../components/Toast";
import { Topbar } from "../../components/Topbar";
import { CustomSelect } from "../../components/CustomSelect";
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
import { ACTIVE_PROJECT_KEY } from "../../lib/board-reducer";
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
  const { user, sessionStatus, refreshSession, showToast, refreshProjects, projectKey, selectProject } = useBoard();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUserDetail[]>([]);
  const [projects, setProjects] = useState<AdminProjectDetail[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const setNote = useCallback(
    (msg: string | null) => {
      if (msg) showToast(msg, "error");
    },
    [showToast],
  );
  const [resetTarget, setResetTarget] = useState<AdminUserDetail | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);
  const [deleteProjectKey, setDeleteProjectKey] = useState<string | null>(null);
  const [deleteProjectStep, setDeleteProjectStep] = useState<1 | 2>(1);
  const [deleteProjectError, setDeleteProjectError] = useState<string | null>(null);
  const [deleteColumnKey, setDeleteColumnKey] = useState<string | null>(null);
  const [deleteColumnError, setDeleteColumnError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [renameProject, setRenameProject] = useState<AdminProjectDetail | null>(null);
  const [memberEditor, setMemberEditor] = useState<AdminProjectDetail | null>(null);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string>("");
  const [renameColumn, setRenameColumn] = useState<BoardColumn | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);

  const pending = useMemo(() => users.filter((u) => u.status === "pending"), [users]);

  const refreshColumns = useCallback(async (key: string) => {
    if (!key) return;
    try {
      const cols = await api.admin.listColumns(key);
      setColumns(cols);
    } catch {
      setColumns([]);
    }
  }, []);

  const selectColumnProject = useCallback(async (key: string) => {
    setSelectedProjectKey(key);
    void selectProject(key);
    await refreshColumns(key);
  }, [refreshColumns, selectProject]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([api.admin.listUsers(), api.admin.listProjects()]);
      setUsers(u);
      setProjects(p);
      let storedKey: string | null = null;
      try {
        storedKey = localStorage.getItem(ACTIVE_PROJECT_KEY);
      } catch {
        storedKey = null;
      }
      const preferred = projectKey || storedKey;
      const initialKey = preferred && p.some((x) => x.key === preferred) ? preferred : (p[0]?.key ?? "");
      setSelectedProjectKey((cur) => {
        const nextKey = cur && p.some((x) => x.key === cur) ? cur : initialKey;
        if (nextKey) void refreshColumns(nextKey);
        return nextKey;
      });
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Admin load failed");
    } finally {
      setLoading(false);
    }
  }, [refreshColumns, projectKey, setNote]);

  useEffect(() => {
    if (projectKey && projectKey !== selectedProjectKey && projects.some((x) => x.key === projectKey)) {
      setSelectedProjectKey(projectKey);
      void refreshColumns(projectKey);
    }
  }, [projectKey, selectedProjectKey, projects, refreshColumns]);

  useEffect(() => {
    if (sessionStatus === "anon") router.push("/login?next=/admin");
  }, [sessionStatus, router]);

  useEffect(() => {
    if (sessionStatus === "authed" && !user) void refreshSession();
  }, [sessionStatus, user, refreshSession]);

  useEffect(() => {
    if (user && user.role !== "admin") router.push("/dashboard");
  }, [user, router]);

  useEffect(() => {
    if (user?.role === "admin") void load();
  }, [user, load]);

  const mutateUsers = async (fn: () => Promise<unknown>, fail: string, successMsg?: string) => {
    try {
      await fn();
      const u = await api.admin.listUsers();
      setUsers(u);
      if (successMsg) showToast(successMsg, "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : fail, "error");
    }
  };

  const setRole = (u: AdminUserDetail, role: Role) => {
    const prev = users;
    setUsers(prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
    api.admin.updateUser(u.id, { role })
      .then(() => {
        showToast(`User role updated to ${role}`, "success");
      })
      .catch((err: unknown) => {
        setUsers(prev);
        showToast(err instanceof ApiError ? err.message : "Role update failed", "error");
      });
  };

  const setStatus = (u: AdminUserDetail, status: UserStatus) =>
    mutateUsers(() => api.admin.updateUser(u.id, { status }), "Status update failed", `User status updated to ${status}`);

  const approveWithRole = (u: AdminUserDetail, role: Role) =>
    mutateUsers(() => api.admin.updateUser(u.id, { status: "active", role }), "Approve failed", `User ${u.displayName} approved`);

  const doResetPassword = async () => {
    if (!resetTarget || !resetPw || resetPw.length < 8) return;
    setResetError(null);
    try {
      await api.admin.updateUser(resetTarget.id, { password: resetPw });
      setResetTarget(null);
      setResetPw("");
      showToast("Password reset successfully", "success");
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : "Reset failed");
    }
  };

  const doDeleteUser = async () => {
    if (deleteUserId == null) return;
    setDeleteBusy(true);
    setDeleteUserError(null);
    try {
      await api.admin.deleteUser(deleteUserId);
      setDeleteUserId(null);
      const u = await api.admin.listUsers();
      setUsers(u);
      showToast("User deleted successfully", "success");
    } catch (err) {
      setDeleteUserError(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
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
          <Link href="/dashboard">Board</Link> / Admin
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
            onReset={(u) => { setResetTarget(u); setResetPw(randomPassword()); setResetError(null); }}
            onDelete={(id) => { setDeleteUserId(id); setDeleteUserError(null); }}
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
            onDelete={(k) => { setDeleteProjectKey(k); setDeleteProjectStep(1); setDeleteProjectError(null); }}
            onMembers={setMemberEditor}
          />
        ) : (
          <ColumnsTab
            projects={projects}
            selectedProjectKey={selectedProjectKey}
            onSelectProject={selectColumnProject}
            columns={columns}
            setColumns={setColumns}
            setNote={setNote}
            showToast={showToast}
            onAdd={() => setAddColumnOpen(true)}
            onRename={setRenameColumn}
            onDelete={(k) => { setDeleteColumnKey(k); setDeleteColumnError(null); }}
          />
        )}
      </main>
      {resetTarget ? (
        <Modal
          title={`Reset password — ${resetTarget.username}`}
          onClose={() => {
            setResetTarget(null);
            setResetError(null);
          }}
        >
          {resetError && (
            <div className="form-error-banner" role="alert" style={{ marginBottom: "14px" }}>
              <strong>Error:</strong> <span>{resetError}</span>
            </div>
          )}
          <div className="field">
            <label htmlFor="resetPw">New password</label>
            <input
              className={`input${resetPw.length < 8 ? " input-error" : ""}`}
              id="resetPw"
              value={resetPw}
              onChange={(e) => {
                setResetPw(e.target.value);
                setResetError(null);
              }}
            />
            {resetPw.length < 8 && (
              <span className="field-error-msg">Password must be at least 8 characters</span>
            )}
          </div>
          <div className="dialog-foot">
            <button className="btn-chunk btn-ghost" onClick={() => { setResetPw(randomPassword()); setResetError(null); }}>
              Random
            </button>
            <button
              className="btn-chunk btn-ghost"
              onClick={() => { void navigator.clipboard?.writeText(resetPw).catch(() => undefined); }}
            >
              Copy
            </button>
            <button className="btn-chunk btn-go" onClick={doResetPassword} disabled={resetPw.length < 8}>
              Save
            </button>
          </div>
        </Modal>
      ) : null}
      {deleteUserId != null ? (
        <Modal
          title="Delete user"
          onClose={() => {
            setDeleteUserId(null);
            setDeleteUserError(null);
          }}
        >
          {deleteUserError && (
            <div className="form-error-banner" role="alert" style={{ marginBottom: "14px" }}>
              <strong>Error:</strong> <span>{deleteUserError}</span>
            </div>
          )}
          <p className="auth-note">Delete this user? Blocked if issues are assigned to them.</p>
          <div className="dialog-foot">
            <button
              className="btn-chunk btn-ghost"
              onClick={() => {
                setDeleteUserId(null);
                setDeleteUserError(null);
              }}
            >
              Cancel
            </button>
            <button className="btn-chunk btn-del" onClick={doDeleteUser} disabled={deleteBusy}>
              {deleteBusy ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Modal>
      ) : null}
      {createUserOpen ? (
        <CreateUserModal
          onClose={() => setCreateUserOpen(false)}
          onDone={async () => {
            setCreateUserOpen(false);
            const u = await api.admin.listUsers();
            setUsers(u);
            showToast("User created successfully", "success");
          }}
          onError={setNote}
        />
      ) : null}
      {createProjectOpen ? (
        <CreateProjectModal
          onClose={() => setCreateProjectOpen(false)}
          onDone={(p) => {
            setCreateProjectOpen(false);
            const detail: AdminProjectDetail = {
              ...p,
              members: p.members ?? [],
              issueCount: p.issueCount ?? 0,
            };
            setProjects((prev) => [...prev, detail]);
            void selectColumnProject(p.key);
            void refreshProjects(p.key);
            showToast("Project created successfully", "success");
          }}
          onError={setNote}
        />
      ) : null}
      {renameProject ? (
        <RenameProjectModal
          project={renameProject}
          onClose={() => setRenameProject(null)}
          onDone={(p) => {
            setRenameProject(null);
            setProjects((prev) => prev.map((x) => (x.key === renameProject.key ? p : x)));
            void refreshProjects(p.key);
            showToast("Project updated successfully", "success");
          }}
          onError={setNote}
        />
      ) : null}
      {deleteProjectKey ? (() => {
        const target = projects.find((p) => p.key === deleteProjectKey);
        const count = target?.issueCount ?? 0;
        return (
          <Modal
            title={deleteProjectStep === 1 ? "Delete project" : `Confirm Deletion — ${deleteProjectKey}`}
            onClose={() => {
              setDeleteProjectKey(null);
              setDeleteProjectStep(1);
              setDeleteProjectError(null);
            }}
          >
            {deleteProjectError && (
              <div className="form-error-banner" role="alert" style={{ marginBottom: "14px" }}>
                <strong>Error:</strong> <span>{deleteProjectError}</span>
              </div>
            )}
            
            {deleteProjectStep === 1 ? (
              <>
                <p className="auth-note" style={{ marginBottom: count > 0 ? "16px" : undefined }}>
                  {count > 0 
                    ? `Delete ${deleteProjectKey}? This project still has ${count} issue${count === 1 ? '' : 's'}. You will be asked to confirm once more before deleting.`
                    : `Delete ${deleteProjectKey}? This action cannot be undone.`}
                </p>
                <div className="dialog-foot">
                  <button
                    className="btn-chunk btn-ghost"
                    onClick={() => {
                      setDeleteProjectKey(null);
                      setDeleteProjectStep(1);
                      setDeleteProjectError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-chunk btn-del"
                    disabled={deleteBusy}
                    onClick={async () => {
                      if (count > 0) {
                        setDeleteProjectStep(2);
                        return;
                      }
                      setDeleteBusy(true);
                      setDeleteProjectError(null);
                      try {
                        await api.admin.deleteProject(deleteProjectKey, false);
                        setProjects((prev) => prev.filter((x) => x.key !== deleteProjectKey));
                        setDeleteProjectKey(null);
                        if (selectedProjectKey === deleteProjectKey) {
                          setSelectedProjectKey("");
                          setColumns([]);
                        }
                        void refreshProjects();
                        showToast(`Project ${deleteProjectKey} deleted successfully`, "success");
                      } catch (err) {
                        setDeleteProjectError(err instanceof ApiError ? err.message : "Delete failed");
                        if (err instanceof ApiError && err.message.includes("still has")) {
                          setDeleteProjectStep(2); // Provide fallback way to force delete
                        }
                      } finally {
                        setDeleteBusy(false);
                      }
                    }}
                  >
                    {deleteBusy ? "Deleting..." : count > 0 ? "Proceed..." : "Delete"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ border: "2px solid var(--fg)", background: "var(--coral)", padding: "12px", marginBottom: "16px" }}>
                  <p style={{ margin: "0 0 8px 0", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", textTransform: "uppercase" }}>
                    <span style={{ fontSize: "1.2em" }}>⚠️</span> Final Warning
                  </p>
                  <p style={{ margin: 0, fontWeight: 500 }}>
                    {deleteProjectKey} still has {count} active issue{count === 1 ? '' : 's'}. Deleting this project will permanently erase all its issues, checklists, columns, and sprint data.
                  </p>
                  <p style={{ margin: "8px 0 0 0", fontWeight: 700, textTransform: "uppercase" }}>This action is irreversible.</p>
                </div>
                <div className="dialog-foot">
                  <button
                    className="btn-chunk btn-ghost"
                    onClick={() => setDeleteProjectStep(1)}
                  >
                    Back
                  </button>
                  <button
                    className="btn-chunk btn-del"
                    disabled={deleteBusy}
                    onClick={async () => {
                      setDeleteBusy(true);
                      setDeleteProjectError(null);
                      try {
                        await api.admin.deleteProject(deleteProjectKey, true);
                        setProjects((prev) => prev.filter((x) => x.key !== deleteProjectKey));
                        setDeleteProjectKey(null);
                        setDeleteProjectStep(1);
                        if (selectedProjectKey === deleteProjectKey) {
                          setSelectedProjectKey("");
                          setColumns([]);
                        }
                        void refreshProjects();
                        showToast(`Project ${deleteProjectKey} and all issues deleted`, "success");
                      } catch (err) {
                        setDeleteProjectError(err instanceof ApiError ? err.message : "Cascade delete failed");
                      } finally {
                        setDeleteBusy(false);
                      }
                    }}
                  >
                    {deleteBusy ? "Deleting..." : "Yes, Delete Project & Issues"}
                  </button>
                </div>
              </>
            )}
          </Modal>
        );
      })() : null}
      {memberEditor ? (
        <MembersModal
          project={memberEditor}
          users={users.filter((u) => u.status === "active")}
          onClose={() => setMemberEditor(null)}
          onDone={(p) => {
            setMemberEditor(null);
            setProjects((prev) => prev.map((x) => (x.key === p.key ? p : x)));
            showToast("Project members updated successfully", "success");
          }}
          onError={setNote}
        />
      ) : null}
      {addColumnOpen ? (
        <AddColumnModal
          projectKey={selectedProjectKey}
          onClose={() => setAddColumnOpen(false)}
          onDone={async () => {
            setAddColumnOpen(false);
            await refreshColumns(selectedProjectKey);
            showToast("Column created successfully", "success");
          }}
          onError={setNote}
        />
      ) : null}
      {renameColumn ? (
        <RenameColumnModal
          projectKey={selectedProjectKey}
          column={renameColumn}
          onClose={() => setRenameColumn(null)}
          onDone={async () => {
            setRenameColumn(null);
            await refreshColumns(selectedProjectKey);
            showToast("Column updated successfully", "success");
          }}
          onError={setNote}
        />
      ) : null}
      {deleteColumnKey ? (
        <Modal
          title="Delete column"
          onClose={() => {
            setDeleteColumnKey(null);
            setDeleteColumnError(null);
          }}
        >
          {deleteColumnError && (
            <div className="form-error-banner" role="alert" style={{ marginBottom: "14px" }}>
              <strong>Error:</strong> <span>{deleteColumnError}</span>
            </div>
          )}
          <p className="auth-note">Delete {deleteColumnKey}? Blocked when issues live there.</p>
          <div className="dialog-foot">
            <button
              className="btn-chunk btn-ghost"
              onClick={() => {
                setDeleteColumnKey(null);
                setDeleteColumnError(null);
              }}
            >
              Cancel
            </button>
            <button
              className="btn-chunk btn-del"
              disabled={deleteBusy}
              onClick={async () => {
                setDeleteBusy(true);
                setDeleteColumnError(null);
                try {
                  await api.admin.deleteColumn(selectedProjectKey, deleteColumnKey);
                  await refreshColumns(selectedProjectKey);
                  setDeleteColumnKey(null);
                  showToast("Column deleted successfully", "success");
                } catch (err) {
                  if (err instanceof ApiError && err.status === 404) {
                    await refreshColumns(selectedProjectKey);
                    setDeleteColumnKey(null);
                    showToast("Column deleted successfully", "success");
                  } else {
                    setDeleteColumnError(err instanceof ApiError ? err.message : "Delete failed");
                  }
                } finally {
                  setDeleteBusy(false);
                }
              }}
            >
              {deleteBusy ? "Deleting..." : "Delete"}
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
      <CustomSelect
        className="adm-select"
        aria-label={`Role for ${u.username}`}
        value={u.role}
        options={[
          { value: "member", label: "member" },
          { value: "admin", label: "admin" },
        ]}
        onChange={(val) => onRole(u, val as Role)}
      />
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
          <CustomSelect
            className="adm-select"
            aria-label={`Approve role for ${u.username}`}
            value={roles[u.id] ?? "member"}
            options={[
              { value: "member", label: "member" },
              { value: "admin", label: "admin" },
            ]}
            onChange={(val) => setRoles((prev) => ({ ...prev, [u.id]: val as Role }))}
          />
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
            <span className="kicker">{p.issueCount ?? 0} issues</span>
            <span className="chip-row">
              {(p.members ?? []).slice(0, 6).map((m) => (
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
  projects: AdminProjectDetail[];
  selectedProjectKey: string;
  onSelectProject: (k: string) => void;
  columns: BoardColumn[];
  setColumns: React.Dispatch<React.SetStateAction<BoardColumn[]>>;
  setNote: (m: string | null) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
  onAdd: () => void;
  onRename: (c: BoardColumn) => void;
  onDelete: (k: string) => void;
}) {
  const move = async (idx: number, dir: -1 | 1) => {
    if (!props.selectedProjectKey) return;
    const next = [...props.columns];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[idx];
    next[idx] = next[j];
    next[j] = tmp;
    const prev = props.columns;
    props.setColumns(next);
    try {
      await api.admin.reorderColumns(props.selectedProjectKey, { orderedKeys: next.map((c) => c.key) });
      props.showToast("Columns reordered successfully", "success");
    } catch (err) {
      props.setColumns(prev);
      props.setNote(err instanceof ApiError ? err.message : "Reorder failed");
    }
  };

  const setKind = async (c: BoardColumn, kind: ColumnKind) => {
    if (!props.selectedProjectKey) return;
    const prev = props.columns;
    props.setColumns(prev.map((x) => (x.key === c.key ? { ...x, kind } : x)));
    try {
      const updated = await api.admin.updateColumn(props.selectedProjectKey, c.key, { kind });
      props.setColumns((cur) => cur.map((x) => (x.key === c.key ? updated : x)));
      props.showToast("Column updated successfully", "success");
    } catch (err) {
      props.setColumns(prev);
      props.setNote(err instanceof ApiError ? err.message : "Kind update failed");
    }
  };

  return (
    <section aria-label="Columns">
      <div className="btn-row" style={{ alignItems: "center", gap: 12, marginBottom: 16 }}>
        <label htmlFor="colProjSelect" className="kicker" style={{ margin: 0 }}>
          Project:
        </label>
        <CustomSelect
          id="colProjSelect"
          style={{ width: "auto", minWidth: 200 }}
          value={props.selectedProjectKey}
          options={props.projects.map((p) => ({ value: p.key, label: `${p.key} (${p.name})` }))}
          onChange={(val) => props.onSelectProject(val)}
        />
        <button className="btn-chunk btn-new" onClick={props.onAdd} disabled={!props.selectedProjectKey}>
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
            <CustomSelect<ColumnKind>
              className="adm-select"
              aria-label={`Kind for ${c.label}`}
              value={c.kind}
              options={COLUMN_KINDS.map((k) => ({ value: k, label: k }))}
              onChange={(val) => setKind(c, val)}
            />
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
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isFieldTouched = (field: string) => submitted || !!touched[field];
  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const usernameClean = username.trim();
  const uErr = !usernameClean
    ? "Username is required"
    : !/^[a-z0-9._-]{3,32}$/.test(usernameClean)
    ? "3-32 chars (lowercase letters, digits, dot, dash, underscore)"
    : null;

  const displayNameClean = displayName.trim();
  const nErr = !displayNameClean
    ? "Display name is required"
    : displayNameClean.length < 2 || displayNameClean.length > 60
    ? "Must be 2-60 characters"
    : null;

  const pErr = !password
    ? "Password is required"
    : password.length < 8 || password.length > 72
    ? "Must be 8-72 characters"
    : null;

  const hasClientError = Boolean(uErr || nErr || pErr);

  const submit = async () => {
    setSubmitted(true);
    if (hasClientError || busy) return;
    setBusy(true);
    setServerError(null);
    try {
      await api.admin.createUser({ username: usernameClean, displayName: displayNameClean, password, role });
      await props.onDone();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Create failed";
      setServerError(msg);
      props.onError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Add user" onClose={props.onClose}>
      {serverError && (
        <div className="form-error-banner" role="alert" style={{ marginBottom: "14px" }}>
          <strong>Error:</strong> <span>{serverError}</span>
        </div>
      )}
      <div className="field">
        <label htmlFor="cuUser">Username</label>
        <input
          className={`input${isFieldTouched("username") && uErr ? " input-error" : ""}`}
          id="cuUser"
          value={username}
          placeholder="e.g. john_doe"
          onChange={(e) => {
            setUsername(e.target.value);
            setServerError(null);
          }}
          onBlur={() => markTouched("username")}
        />
        {isFieldTouched("username") && uErr && <span className="field-error-msg">{uErr}</span>}
      </div>
      <div className="field">
        <label htmlFor="cuName">Display name</label>
        <input
          className={`input${isFieldTouched("displayName") && nErr ? " input-error" : ""}`}
          id="cuName"
          value={displayName}
          placeholder="e.g. John Doe"
          onChange={(e) => {
            setDisplayName(e.target.value);
            setServerError(null);
          }}
          onBlur={() => markTouched("displayName")}
        />
        {isFieldTouched("displayName") && nErr && <span className="field-error-msg">{nErr}</span>}
      </div>
      <div className="field">
        <label htmlFor="cuPass">Password</label>
        <input
          className={`input${isFieldTouched("password") && pErr ? " input-error" : ""}`}
          id="cuPass"
          type="password"
          value={password}
          placeholder="At least 8 characters"
          onChange={(e) => {
            setPassword(e.target.value);
            setServerError(null);
          }}
          onBlur={() => markTouched("password")}
        />
        {isFieldTouched("password") && pErr && <span className="field-error-msg">{pErr}</span>}
      </div>
      <div className="field">
        <label htmlFor="cuRole">Role</label>
        <CustomSelect
          id="cuRole"
          value={role}
          options={[
            { value: "member", label: "member" },
            { value: "admin", label: "admin" },
          ]}
          onChange={(val) => setRole(val as Role)}
        />
      </div>
      <div className="dialog-foot">
        <button className="btn-chunk btn-ghost" onClick={props.onClose} disabled={busy}>
          Cancel
        </button>
        <button className="btn-chunk btn-go" onClick={submit} disabled={busy || (submitted && hasClientError)}>
          {busy ? "Creating..." : "Create"}
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
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isFieldTouched = (field: string) => submitted || !!touched[field];
  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const nameClean = name.trim();
  const keyClean = key.trim();

  const nameErr = !nameClean
    ? "Project name is required"
    : nameClean.length > 60
    ? "Max 60 characters"
    : null;

  const keyErr = !keyClean
    ? "Project key is required"
    : !/^[A-Z0-9-]{2,32}$/.test(keyClean)
    ? "Key must be 2-32 characters (A-Z, digits or dash)"
    : null;

  const hasClientError = Boolean(nameErr || keyErr);

  const submit = async () => {
    setSubmitted(true);
    if (hasClientError || busy) return;
    setBusy(true);
    setServerError(null);
    try {
      const p = await api.admin.createProject({ key: keyClean, name: nameClean });
      props.onDone(p);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Create failed";
      setServerError(msg);
      props.onError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Add project" onClose={props.onClose}>
      {serverError && (
        <div className="form-error-banner" role="alert" style={{ marginBottom: "14px" }}>
          <strong>Error:</strong> <span>{serverError}</span>
        </div>
      )}
      <div className="field">
        <label htmlFor="cpName">Name</label>
        <input
          className={`input${isFieldTouched("name") && nameErr ? " input-error" : ""}`}
          id="cpName"
          value={name}
          placeholder="e.g. Mobile App"
          onChange={(e) => {
            setName(e.target.value);
            setServerError(null);
            if (!keyTouched) setKey(slugify(e.target.value));
          }}
          onBlur={() => markTouched("name")}
        />
        {isFieldTouched("name") && nameErr && <span className="field-error-msg">{nameErr}</span>}
      </div>
      <div className="field">
        <label htmlFor="cpKey">Key</label>
        <input
          className={`input${isFieldTouched("key") && keyErr ? " input-error" : ""}`}
          id="cpKey"
          value={key}
          placeholder="e.g. MOB"
          onChange={(e) => {
            setKey(slugify(e.target.value));
            setKeyTouched(true);
            setServerError(null);
          }}
          onBlur={() => markTouched("key")}
        />
        {isFieldTouched("key") && keyErr && <span className="field-error-msg">{keyErr}</span>}
      </div>
      <div className="dialog-foot">
        <button className="btn-chunk btn-ghost" onClick={props.onClose} disabled={busy}>
          Cancel
        </button>
        <button className="btn-chunk btn-go" onClick={submit} disabled={busy || (submitted && hasClientError)}>
          {busy ? "Creating..." : "Create"}
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
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameClean = name.trim();
  const nameErr = !nameClean
    ? "Project name is required"
    : nameClean.length > 60
    ? "Max 60 characters"
    : null;

  const submit = async () => {
    setTouched(true);
    if (nameErr || busy) return;
    setBusy(true);
    setServerError(null);
    try {
      const p = await api.admin.updateProject(props.project.key, { name: nameClean });
      props.onDone(p);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Rename failed";
      setServerError(msg);
      props.onError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Rename ${props.project.key}`} onClose={props.onClose}>
      {serverError && (
        <div className="form-error-banner" role="alert" style={{ marginBottom: "14px" }}>
          <strong>Error:</strong> <span>{serverError}</span>
        </div>
      )}
      <div className="field">
        <label htmlFor="rpName">Name</label>
        <input
          className={`input${touched && nameErr ? " input-error" : ""}`}
          id="rpName"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setServerError(null);
          }}
          onBlur={() => setTouched(true)}
        />
        {touched && nameErr && <span className="field-error-msg">{nameErr}</span>}
      </div>
      <div className="dialog-foot">
        <button className="btn-chunk btn-ghost" onClick={props.onClose} disabled={busy}>
          Cancel
        </button>
        <button className="btn-chunk btn-go" onClick={submit} disabled={busy || (touched && !!nameErr)}>
          {busy ? "Saving..." : "Save"}
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
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (code: string) => {
    setServerError(null);
    setCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setServerError(null);
    try {
      const p = await api.admin.setMembers(props.project.key, { codes });
      props.onDone(p);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Members update failed";
      setServerError(msg);
      props.onError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Members — ${props.project.key}`} onClose={props.onClose}>
      {serverError && (
        <div className="form-error-banner" role="alert" style={{ marginBottom: "14px" }}>
          <strong>Error:</strong> <span>{serverError}</span>
        </div>
      )}
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
        <button className="btn-chunk btn-ghost" onClick={props.onClose} disabled={busy}>
          Cancel
        </button>
        <button className="btn-chunk btn-go" onClick={submit} disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}

function AddColumnModal(props: {
  projectKey: string;
  onClose: () => void;
  onDone: (c: BoardColumn) => void;
  onError: (m: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<ColumnKind>("active");
  const [color, setColor] = useState<ColumnColor>("sky");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const labelClean = label.trim();
  const labelErr = !labelClean
    ? "Label is required"
    : labelClean.length > 40
    ? "Max 40 characters"
    : null;

  const submit = async () => {
    setTouched(true);
    if (labelErr || busy) return;
    setBusy(true);
    setServerError(null);
    try {
      const c = await api.admin.createColumn(props.projectKey, { label: labelClean, kind, color });
      props.onDone(c);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Create failed";
      setServerError(msg);
      props.onError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Add column" onClose={props.onClose}>
      {serverError && (
        <div className="form-error-banner" role="alert" style={{ marginBottom: "14px" }}>
          <strong>Error:</strong> <span>{serverError}</span>
        </div>
      )}
      <div className="field">
        <label htmlFor="acLabel">Label</label>
        <input
          className={`input${touched && labelErr ? " input-error" : ""}`}
          id="acLabel"
          value={label}
          placeholder="e.g. In Review"
          onChange={(e) => {
            setLabel(e.target.value);
            setServerError(null);
          }}
          onBlur={() => setTouched(true)}
        />
        {touched && labelErr && <span className="field-error-msg">{labelErr}</span>}
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
        <button className="btn-chunk btn-ghost" onClick={props.onClose} disabled={busy}>
          Cancel
        </button>
        <button className="btn-chunk btn-go" onClick={submit} disabled={busy || (touched && !!labelErr)}>
          {busy ? "Creating..." : "Create"}
        </button>
      </div>
    </Modal>
  );
}

function RenameColumnModal(props: {
  projectKey: string;
  column: BoardColumn;
  onClose: () => void;
  onDone: (c: BoardColumn) => void;
  onError: (m: string) => void;
}) {
  const [label, setLabel] = useState(props.column.label);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const labelClean = label.trim();
  const labelErr = !labelClean
    ? "Label is required"
    : labelClean.length > 40
    ? "Max 40 characters"
    : null;

  const submit = async () => {
    setTouched(true);
    if (labelErr || busy) return;
    setBusy(true);
    setServerError(null);
    try {
      const c = await api.admin.updateColumn(props.projectKey, props.column.key, { label: labelClean });
      props.onDone(c);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Rename failed";
      setServerError(msg);
      props.onError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Rename ${props.column.key}`} onClose={props.onClose}>
      {serverError && (
        <div className="form-error-banner" role="alert" style={{ marginBottom: "14px" }}>
          <strong>Error:</strong> <span>{serverError}</span>
        </div>
      )}
      <div className="field">
        <label htmlFor="rcLabel">Label</label>
        <input
          className={`input${touched && labelErr ? " input-error" : ""}`}
          id="rcLabel"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setServerError(null);
          }}
          onBlur={() => setTouched(true)}
        />
        {touched && labelErr && <span className="field-error-msg">{labelErr}</span>}
      </div>
      <div className="dialog-foot">
        <button className="btn-chunk btn-ghost" onClick={props.onClose} disabled={busy}>
          Cancel
        </button>
        <button className="btn-chunk btn-go" onClick={submit} disabled={busy || (touched && !!labelErr)}>
          {busy ? "Saving..." : "Save"}
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
