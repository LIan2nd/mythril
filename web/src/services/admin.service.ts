import { ConflictError, NotFoundError, ValidationError } from '@/domain/errors';
import type { BoardColumnRepo, IssueRepo, ProjectRepo, SprintRepo, UserRepo } from '@/domain/repositories';
import type {
  AdminCreateUserPayload,
  AdminProjectDetail,
  AdminUpdateUserPayload,
  AuthUser,
  BoardColumn,
  CreateColumnPayload,
  Project,
  ReorderColumnsPayload,
  UpdateColumnPayload,
  UserStatus,
} from '@/domain/types';
import { DEFAULT_COLUMNS } from '@/domain/types';
import { hashPassword } from '@/server/auth/crypto';
import { codeSlug, pickUniqueCode, requireColumn, slugifyLabel } from './guards';

export interface AdminServiceDeps {
  users: UserRepo;
  projects: ProjectRepo;
  issues: IssueRepo;
  columns: BoardColumnRepo;
  sprints?: SprintRepo;
}

export class AdminService {
  constructor(private readonly deps: AdminServiceDeps) {}

  async listUsers(status?: UserStatus): Promise<AuthUser[]> {
    const all = await this.deps.users.listAuth();
    return status ? all.filter((u) => u.status === status) : all;
  }

  async createUser(input: AdminCreateUserPayload): Promise<AuthUser> {
    if (await this.deps.users.getAuthByUsername(input.username)) {
      throw new ConflictError('That username is already taken');
    }
    if (input.code && (await this.deps.users.getByCode(input.code))) {
      throw new ConflictError(`Badge code ${input.code} is already in use`);
    }
    const code = input.code ?? (await pickUniqueCode(this.deps.users, codeSlug(input.username)));
    return this.deps.users.create({
      code,
      username: input.username,
      displayName: input.displayName,
      passwordHash: hashPassword(input.password),
      role: input.role,
      status: 'active',
      color: 'lav',
    });
  }

  async updateUser(id: number, patch: AdminUpdateUserPayload, actorId: number): Promise<AuthUser> {
    const target = await this.getUserOrThrow(id);
    if (id === actorId && (patch.role === 'member' || patch.status)) {
      throw new ValidationError('You cannot change your own role or status');
    }
    if (target.role === 'admin' && patch.role === 'member') {
      const admins = (await this.deps.users.listAuth()).filter((u) => u.role === 'admin' && u.status === 'active');
      if (admins.length <= 1) throw new ConflictError('Refuse: at least one admin must remain');
    }
    if (patch.code) {
      const holder = await this.deps.users.getByCode(patch.code);
      if (holder) throw new ConflictError(`Badge code ${patch.code} is already in use`);
    }
    const { password, ...rest } = patch;
    const updated = await this.deps.users.adminPatch(id, rest);
    if (password) await this.deps.users.updatePassword(id, hashPassword(password));
    return updated;
  }

  async deleteUser(id: number, actorId: number): Promise<void> {
    if (id === actorId) throw new ValidationError('You cannot delete your own account');
    const target = await this.getUserOrThrow(id);
    if (target.role === 'admin') {
      const admins = (await this.deps.users.listAuth()).filter((u) => u.role === 'admin' && u.status === 'active');
      if (admins.length <= 1) throw new ConflictError('Refuse: at least one admin must remain');
    }
    if (target.code && (await this.deps.issues.countByAssignee(target.code)) > 0) {
      throw new ConflictError('This user still has assigned issues. Reassign them first.');
    }
    await this.deps.users.remove(id);
  }

  async listProjects(): Promise<AdminProjectDetail[]> {
    const [projects, users] = await Promise.all([this.deps.projects.list(), this.deps.users.listAuth()]);
    const userByCode = new Map(users.filter((u) => u.code).map((u) => [u.code as string, u]));
    const details = await Promise.all(
      projects.map(async (project) => {
        const codes = await this.deps.projects.memberCodes(project.id);
        const issueCount = await this.deps.projects.countIssues(project.id);
        return {
          ...project,
          members: codes.map((code) => userByCode.get(code)).filter((u): u is AuthUser => Boolean(u)),
          issueCount,
        };
      }),
    );
    return details;
  }

  async createProject(input: { key: string; name: string }): Promise<AdminProjectDetail> {
    if (await this.deps.projects.getByKey(input.key)) throw new ConflictError(`Project key ${input.key} already exists`);
    const project = await this.deps.projects.create(input);
    for (const col of DEFAULT_COLUMNS) {
      await this.deps.columns.create(project.id, {
        key: col.key,
        label: col.label,
        kind: col.kind,
        color: col.color,
        beforeKey: null,
      });
    }
    if (this.deps.sprints) {
      const now = new Date();
      const end = new Date(now.getTime() + 14 * 86_400_000);
      const startsAt = now.toISOString().slice(0, 10);
      const endsAt = end.toISOString().slice(0, 10);
      await this.deps.sprints.upsertActiveForProject(project.id, {
        number: 1,
        title: 'Forge the sprint. Ship like legend.',
        kicker: 'Active sprint',
        startsAt,
        endsAt,
      });
    }
    return {
      ...project,
      members: [],
      issueCount: 0,
    };
  }

  async renameProject(key: string, patch: { key?: string; name?: string }): Promise<Project> {
    const project = await this.getProjectOrThrow(key);
    if (patch.key && patch.key !== key && (await this.deps.projects.getByKey(patch.key))) {
      throw new ConflictError(`Project key ${patch.key} already exists`);
    }
    return this.deps.projects.update(project.id, patch);
  }

  async deleteProject(key: string, options?: { cascade?: boolean }): Promise<void> {
    const project = await this.getProjectOrThrow(key);
    const issueCount = await this.deps.projects.countIssues(project.id);
    if (issueCount > 0 && !options?.cascade) {
      throw new ConflictError(`Project still has ${issueCount} issue(s). Confirm cascade delete or move them first.`);
    }
    await this.deps.projects.remove(project.id);
  }

  async setProjectMembers(key: string, codes: string[], actor?: AuthUser): Promise<AdminProjectDetail> {
    const project = await this.getProjectOrThrow(key);
    const unique = [...new Set(codes)];
    const users = await this.deps.users.listAuth();
    const byCode = new Map(users.filter((u) => u.code).map((u) => [u.code as string, u]));
    for (const code of unique) {
      const user = byCode.get(code);
      if (!user) throw new ValidationError(`Unknown member code "${code}"`);
      if (user.status !== 'active') throw new ValidationError(`"${code}" is not an active user`);
    }

    const currentCodes = await this.deps.projects.memberCodes(project.id);
    const removedCodes = currentCodes.filter((c) => !unique.includes(c));

    if (removedCodes.length > 0) {
      const issues = await this.deps.issues.listByProject(project.id);
      const issuesNeedingReassign = issues.filter((i) => i.assignee && removedCodes.includes(i.assignee.code));

      if (issuesNeedingReassign.length > 0) {
        let targetCode: string | null = null;
        if (actor?.code && unique.includes(actor.code)) {
          targetCode = actor.code;
        } else if (unique.length > 0) {
          const sorted = [...unique].sort();
          targetCode = sorted[0];
        }

        if (!targetCode) {
          throw new ConflictError('Cannot remove last member while issues are assigned');
        }

        await this.deps.issues.reassign(project.id, removedCodes, targetCode);
      }
    }

    await this.deps.projects.setMembers(project.id, unique);
    return {
      ...project,
      members: unique.map((code) => byCode.get(code) as AuthUser),
      issueCount: await this.deps.projects.countIssues(project.id),
    };
  }

  async listColumns(projectKey: string): Promise<BoardColumn[]> {
    const project = await this.getProjectOrThrow(projectKey);
    return this.deps.columns.list(project.id);
  }

  async createColumn(projectKey: string, input: CreateColumnPayload): Promise<BoardColumn> {
    const project = await this.getProjectOrThrow(projectKey);
    if (input.beforeKey) {
      const anchor = await this.deps.columns.getByKey(project.id, input.beforeKey);
      if (!anchor) throw new ValidationError(`Unknown column "${input.beforeKey}"`);
    }
    const base = slugifyLabel(input.label);
    let candidate = base;
    for (let n = 1; (await this.deps.columns.getByKey(project.id, candidate)); n += 1) {
      candidate = `${base}-${n}`;
    }
    return this.deps.columns.create(project.id, { key: candidate, label: input.label, kind: input.kind, color: input.color, beforeKey: input.beforeKey ?? null });
  }

  async updateColumn(projectKey: string, key: string, patch: UpdateColumnPayload): Promise<BoardColumn> {
    const project = await this.getProjectOrThrow(projectKey);
    await requireColumn(this.deps.columns, project.id, key);
    return this.deps.columns.update(project.id, key, patch);
  }

  async reorderColumns(projectKey: string, payload: ReorderColumnsPayload): Promise<BoardColumn[]> {
    const project = await this.getProjectOrThrow(projectKey);
    const current = await this.deps.columns.list(project.id);
    const same =
      payload.orderedKeys.length === current.length &&
      [...current].map((c) => c.key).sort().join() === [...payload.orderedKeys].sort().join();
    if (!same) throw new ValidationError('orderedKeys must list every column key exactly once');
    return this.deps.columns.reorder(project.id, payload.orderedKeys);
  }

  async deleteColumn(projectKey: string, key: string): Promise<void> {
    const project = await this.getProjectOrThrow(projectKey);
    const column = await this.deps.columns.getByKey(project.id, key);
    if (!column) throw new NotFoundError(`Column ${key} not found`);
    if ((await this.deps.issues.countByProjectAndStatus(project.id, key)) > 0) {
      throw new ConflictError(`Column "${column.label}" still has issues. Move them first.`);
    }
    await this.deps.columns.remove(project.id, key);
  }

  private async getUserOrThrow(id: number): Promise<AuthUser> {
    const users = await this.deps.users.listAuth();
    const found = users.find((u) => u.id === id);
    if (!found) throw new NotFoundError(`User ${id} not found`);
    return found;
  }

  private async getProjectOrThrow(key: string): Promise<Project> {
    const project = await this.deps.projects.getByKey(key);
    if (!project) throw new NotFoundError(`Project ${key} not found`);
    return project;
  }
}
