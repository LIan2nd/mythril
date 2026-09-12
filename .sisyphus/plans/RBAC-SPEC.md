# MYTHRIL RBAC — Auth, Roles, Admin, Dynamic Columns

Companion to SPEC.md. Contract for backend (unit A) + frontend (unit B). Design tokens unchanged (neo-brutalist). UI copy **English**.

## Roles & flow

- `role`: `admin` | `member`. `status`: `pending` | `active` | `disabled` | `rejected`.
- **Login** = username + password only. Sessions: stateless signed cookie (HMAC-SHA256, `SESSION_SECRET` env, dev fallback constant; payload `{uid, exp}` base64url + sig, timingSafeEqual). Cookie `mythril_session`, HttpOnly, SameSite=Lax, path=/, 7d (30d `rememberMe`), `Secure` when NODE_ENV=production.
- Guard helper: `requireUser(req)` → loads CURRENT active user row (instant revocation for disabled/rejected), `requireAdmin(req)` → same + `role==='admin'`. Fail → 401 `UNAUTHENTICATED` / 403 `FORBIDDEN` in error envelope.
- **Register is a request**: `POST /api/auth/register` {username 3-32 `[a-z0-9._-]`, displayName 2-60, password 8-72} → creates `status:'pending', role:'member'`, never auto-sessions. **Login** with pending → 403 message "Your account request is awaiting admin approval."; disabled/rejected → generic blocked message.
- **Admin** creates users directly (`status:'active'`, chosen role + initial password), approves/rejects requests, edits users (role/status/displayName/color), resets passwords, disables, deletes (block 409 if issues assigned to their code).
- Legacy seeded users (MK/JT/AS/RP) get usernames mk/jt/as/rp, password `mythril`, active member. Bootstrap seeds `admin`/`admin123` as admin if no admin exists (log a warning once).
- All existing `/api/projects*`, `/api/issues*`, `/api/checklist-items*` routes now require an ACTIVE user **and project membership** (admin bypasses membership). `GET /api/projects` returns only my projects (admin: all); board + issue mutations → 404/403 for non-members ("You are not a member of this project"). New `project_members(project_id int FK, user_code text FK->users(code), PRIMARY KEY(project_id, user_code))`; backfill: mk/jt/as/rp member of all 3 seeded projects.
- **Admin manages projects** too: `GET /api/admin/projects` (Project[] + members AuthUser[] + issueCount), `POST /api/admin/projects` {key 2-32 slug `[A-Z0-9-]+` unique, name}, `PATCH /api/admin/projects/:key` {name?, key? (rare rename OK, same table updates)}, `DELETE /api/admin/projects/:key` → 204, block 409 ValidationError if it has issues; `PUT /api/admin/projects/:key/members` {codes: string[]} replaces roster (codes must be active users). Issue assignee on create/update must be a member of that project (or the current assignee keeps working after unassignment; only validate NEW assignee). Board response `users` = project roster (admins get full user list there) so the New Issue assignee select is member-scoped.
- Profile self-service: `GET /api/auth/me`; `PATCH /api/auth/profile` {username?, displayName?, color?} (username collision → 409); `PUT /api/auth/password` {currentPassword, newPassword}; `PUT /api/auth/avatar` multipart field `file` (png/jpeg/webp/gif, ≤ 3MB, magic-byte sniff; store BYTEA + content_type + updated_at); `DELETE /api/auth/avatar`. `GET /api/users/:code/avatar` → image bytes (Cache-Control no-store; 404 transparent placeholder). `code` is badge ('MK'), admin-managed only — members can't touch role/code/status.
- Admin users API: `GET /api/admin/users?status=` (AuthUser[]), `POST /api/admin/users` {username, displayName, password, role, code?}, `PATCH /api/admin/users/:id` {role?, status?, displayName?, color?, code?, password?}, `DELETE /api/admin/users/:id`. Approving request = PATCH status 'active'.

## Dynamic columns (replaces hardcoded 4)

New table `board_columns(key text PK, label text NOT NULL, kind text CHECK backlog|active|review|done, color text CHECK lavender|yellow|coral|mint|sky, position int NOT NULL)` — global across projects; `key` immutable (slug from label, suffix on dupes); label/kind/color editable; order via reorder endpoint. Metrics use `kind`: `done` column = "Shipped" %, `review` = In Review stat.

Migration inside `SCHEMA_DDL` (idempotent, must run on the EXISTING local db without data loss):
1. `CREATE TABLE IF NOT EXISTS board_columns ...`
2. seed 4 defaults if table empty — keys todo/progress/review/shipped, labels from COLUMN_LABELS, colors lav/yellow/coral/mint (color names: lavender,yellow,coral,mint), kinds backlog/active/review/done, positions 0..3.
3. `ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;`
4. add FK `issues_status_fkey ... REFERENCES board_columns(key)` guarded by `information_schema` check (DO block); no backfill needed (same 4 keys).
5. users table additions guarded: `username text UNIQUE`, `password_hash text`, `role text NOT NULL DEFAULT 'member'`, `status text NOT NULL DEFAULT 'active'`, `display_name text`, `avatar bytea`, `avatar_type text`, `avatar_updated_at timestamptz`; `name` legacy column kept — display_name defaults from it; backfill username = lower(code) WHERE username IS NULL; keep legacy CREATE/seed compatible (users.code stays PK-ish: currently code is PK — it already is).
6. seed admin mk passwords etc via new statements in existing buildSeedStatements flow (ON CONFLICT DO NOTHING must also UPDATE username/password only if NULL — use DO UPDATE SET ... WHERE users.username IS NULL guard or ON CONFLICT (code) DO NOTHING + follow-up UPDATE WHERE username IS NULL).

Column admin API (requireAdmin): `POST /api/admin/columns` {label, kind, color, beforeKey?} → 201 BoardColumn; `PATCH /api/admin/columns/:key` {label?,kind?,color?} + `PUT /api/admin/columns/reorder` {orderedKeys:[all keys]} → BoardColumn[]; `DELETE /api/admin/columns/:key` → 204, block 409 ValidationError when issues exist there.

## HTTP surface (added)

POST /api/auth/register · POST /api/auth/login {username,password,rememberMe?} → {user} + Set-Cookie · POST /api/auth/logout · GET /api/auth/me → {user} · PATCH /api/auth/profile · PUT /api/auth/password · PUT /api/auth/avatar(multipart) · DELETE /api/auth/avatar · GET /api/users/[code]/avatar · GET /api/admin/users · POST /api/admin/users · PATCH+DELETE /api/admin/users/[id] · POST/PATCH/DELETE /api/admin/columns[/reorder]. Envelope + status codes as existing (`204` delete, 401/403 messages English).

Board GET response now `{project, sprint, users, columns, issues}` (columns sorted by position). `Issue.status` becomes `string` (column key).

## UI (unit B)

- Pages: `/login` (brutalist card: logo mark, inputs, error banner, links → `/register`, remember-me checkbox chunk style), `/register` (request form + confirm-password validation; success = "Request submitted — an admin needs to approve it" card, action → back to login). Existing root board becomes auth-gated client app: on 401 from /api → `window.location='/login'` (keep client-only session; NO middleware; API guards are the real security).
- Topbar right: user chip (avatar img if hasAvatar else colored initials `code`) → menu (Profile / Admin panel if role admin / Sign out). Menu reuses `.proj-menu` pattern.
- `/profile`: identity fields (username, displayName, color chips), avatar: preview circle-square (3px border hard shadow), file input styled `.btn-chunk`, remove; change-password card (current+new); save toasts reuse brutalist Toast.
- `/admin`: tab nav (Users · Requests (pending badge count) · Projects · Columns). Users table brutalist (`.check` list styling): rows w/ username, code, role select, status chip, buttons Approve/Reject (pending), Disable/Enable, Reset password (dialog w/ new password field), Delete (confirm dialog). Requests tab = pending users w/ approve(role select)+reject. Projects tab: list (key/name/members avatars chips/issue counts) with + Add project dialog (key auto-slug from name edit-ok, name), inline Rename dialog, Members editor = toggle chips of active users (PUT members with resulting codes[]), delete ✕ (toast on non-empty 409). Columns tab: rows w/ color preview square, label (inline rename dialog), kind select, ←/→ reorder (buttons chunk style, disabled at edges), delete ✕ (toast on 409), "+ Add column" dialog (label, color pick chips, kind select, insert-position select). Everything via new api client methods; store refresh() pulls columns. Members without projects anywhere: board shows a brutalist "No access yet" panel telling them to wait for assignment.
- Board rendering: headers/col-* classes from `columns[]` (color→token map lavender:var(--lav)... yellow/coral/mint/sky via globals additions); `useBoard` replaces COLUMN_IDS literal with dynamic list from payload; reducer sorts/moves by columns; NewIssueDialog column select options dynamic; IssueCard move arrow visibility by index within columns array. FilterBar stats use columns for done/review semantics via computeSprintStats(issues, columns).

## Out of scope (deliberate)
Per-project column sets, SSO, rate limiting (document gap), MFA, password policy beyond length, avatar CDN storage.
