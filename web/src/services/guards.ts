import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/domain/errors';
import type { BoardColumnRepo, ProjectRepo, UserRepo } from '@/domain/repositories';
import type { AuthUser, BoardColumn } from '@/domain/types';

export const NOT_A_MEMBER_MESSAGE = 'You are not a member of this project';

export async function requireProjectByKey(projects: ProjectRepo, key: string) {
  const project = await projects.getByKey(key);
  if (!project) throw new NotFoundError(`Project ${key} not found`);
  return project;
}

export async function requireMembership(projects: ProjectRepo, projectId: number, user: AuthUser): Promise<void> {
  if (user.role === 'admin') return;
  if (user.code && (await projects.isMember(projectId, user.code))) return;
  throw new ForbiddenError(NOT_A_MEMBER_MESSAGE);
}

export async function requireColumn(columns: BoardColumnRepo, key: string, field = 'status'): Promise<BoardColumn> {
  const column = await columns.getByKey(key);
  if (!column) throw new ValidationError(`Unknown ${field} "${key}"`);
  return column;
}

export async function requireAssigneeIsMember(
  projects: ProjectRepo,
  users: UserRepo,
  projectId: number,
  code: string,
): Promise<void> {
  const assignee = await users.getByCode(code);
  if (!assignee) throw new ValidationError(`Unknown assignee ${code}`);
  if (!(await projects.isMember(projectId, code))) {
    throw new ValidationError('Assignee must be a member of this project');
  }
}

export function slugifyLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug.slice(0, 48) : 'column';
}

export function codeSlug(username: string): string {
  const base = username.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  return base.length >= 2 ? base : `${base}X`;
}

export async function pickUniqueCode(users: UserRepo, base: string): Promise<string> {
  let candidate = base;
  for (let n = 0; n < 1000; n += 1) {
    if (!(await users.getByCode(candidate))) return candidate;
    candidate = `${base}${n + 1}`;
  }
  throw new ConflictError('Could not allocate a user code, contact an admin');
}
