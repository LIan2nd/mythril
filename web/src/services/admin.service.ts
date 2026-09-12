import { ConflictError, NotFoundError, ValidationError } from '@/domain/errors';
import type { BoardColumnRepo, IssueRepo, ProjectRepo, UserRepo } from '@/domain/repositories';
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
import { hashPassword } from '@/server/auth/crypto';
import { codeSlug, pickUniqueCode, slugifyLabel } from './guards';

export interface AdminServiceDeps {
  users: UserRepo;
  projects: ProjectRepo;
  issues: IssueRepo;
  columns: BoardColumnRepo;
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

  async createProject(input: { key: string; name: string }): Promise<Project> {
    if (await this.deps.projects.getByKey(input.key)) throw new ConflictError(`Project key ${input.key} already exists`);
    return this.deps.projects.create(input);
  }

  async renameProject(key: string, patch: { key?: string; name?: string }): Promise<Project> {
    const project = await this.getProjectOrThrow(key);
    if (patch.key && patch.key !== key && (await this.deps.projects.getByKey(patch.key))) {
      throw new ConflictError(`Project key ${patch.key} already exists`);
    }
    return this.deps.projects.update(project.id, patch);
  }

  async deleteProject(key: string): Promise<void> {
    const project = await this.getProjectOrThrow(key);
    if ((await this.deps.projects.countIssues(project.id)) > 0) {
      throw new ConflictError('Project still has issues. Move or delete them first.');
    }
    await this.deps.projects.remove(project.id);
  }

  async setProjectMembers(key: string, codes: string[]): Promise<AdminProjectDetail> {
    const project = await this.getProjectOrThrow(key);
    const unique = [...new Set(codes)];
    const users = await this.deps.users.listAuth();
    const byCode = new Map(users.filter((u) => u.code).map((u) => [u.code as string, u]));
    for (const code of unique) {
      const user = byCode.get(code);
      if (!user) throw new ValidationError(`Unknown member code "${code}"`);
      if (user.status !== 'active') throw new ValidationError(`"${code}" is not an active user`);
    }
    await this.deps.projects.setMembers(project.id, unique);
    return {
      ...project,
      members: unique.map((code) => byCode.get(code) as AuthUser),
      issueCount: await this.deps.projects.countIssues(project.id),
    };
  }

  async createColumn(input: CreateColumnPayload): Promise<BoardColumn> {
    if (input.beforeKey) {
      const anchor = await this.deps.columns.getByKey(input.beforeKey);
      if (!anchor) throw new ValidationError(`Unknown column "${input.beforeKey}"`);
    }
    const base = slugifyLabel(input.label);
    let candidate = base;
    for (let n = 1; (await this.deps.columns.getByKey(candidate)); n += 1) {
      candidate = `${base}-${n}`;
    }
    return this.deps.columns.create({ key: candidate, label: input.label, kind: input.kind, color: input.color, beforeKey: input.beforeKey ?? null });
  }

  async updateColumn(key: string, patch: UpdateColumnPayload): Promise<BoardColumn> {
    return this.deps.columns.update(key, patch);
  }

  async reorderColumns(payload: ReorderColumnsPayload): Promise<BoardColumn[]> {
    const current = await this.deps.columns.list();
    const same =
      payload.orderedKeys.length === current.length &&
      [...current].map((c) => c.key).sort().join() === [...payload.orderedKeys].sort().join();
    if (!same) throw new ValidationError('orderedKeys must list every column key exactly once');
    return this.deps.columns.reorder(payload.orderedKeys);
  }

  async deleteColumn(key: string): Promise<void> {
    const column = await this.deps.columns.getByKey(key);
    if (!column) throw new NotFoundError(`Column ${key} not found`);
    if ((await this.deps.issues.countByStatus(key)) > 0) {
      throw new ConflictError(`Column "${column.label}" still has issues. Move them first.`);
    }
    await this.deps.columns.remove(key);
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
