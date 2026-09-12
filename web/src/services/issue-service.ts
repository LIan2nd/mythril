import { NotFoundError, ValidationError } from '@/domain/errors';
import type { BoardColumnRepo, IssueRepo, ProjectRepo, UserRepo } from '@/domain/repositories';
import type { AuthUser, CreateIssuePayload, Issue, MoveIssuePayload, UpdateIssuePayload } from '@/domain/types';
import { sortIssuesForBoard } from '@/domain/types';
import {
  requireAssigneeIsMember,
  requireColumn,
  requireMembership,
  requireProjectByKey,
} from './guards';

export const DEFAULT_CHECKLIST = ['Define scope', 'Add test'];

function validateTitle(title: string): void {
  const len = title.trim().length;
  if (len < 1 || len > 120) throw new ValidationError('Title must be 1..120 characters');
}

export interface IssueServiceDeps {
  projects: ProjectRepo;
  users: UserRepo;
  issues: IssueRepo;
  columns: BoardColumnRepo;
}

export class IssueService {
  constructor(private readonly deps: IssueServiceDeps) {}

  async createIssue(projectKey: string, payload: CreateIssuePayload, actor: AuthUser): Promise<Issue> {
    validateTitle(payload.title);
    const texts = payload.checklistTexts?.filter((t) => t.trim().length > 0) ?? [];
    if (texts.length > 5) throw new ValidationError('Checklist is limited to 5 items');

    const project = await requireProjectByKey(this.deps.projects, projectKey);
    await requireMembership(this.deps.projects, project.id, actor);
    await requireColumn(this.deps.columns, payload.status);
    await requireAssigneeIsMember(this.deps.projects, this.deps.users, project.id, payload.assignee);

    return this.deps.issues.create({
      projectId: project.id,
      title: payload.title.trim(),
      description: payload.description?.trim() || `Created from + New Issue · ${new Date().toLocaleDateString('en-GB')}`,
      priority: payload.priority,
      type: payload.type,
      status: payload.status,
      assignee: payload.assignee,
      checklistTexts: texts.length > 0 ? texts : DEFAULT_CHECKLIST,
    });
  }

  async updateIssue(id: number, patch: UpdateIssuePayload, actor: AuthUser): Promise<Issue> {
    if (patch.title !== undefined) validateTitle(patch.title);
    const issue = await this.loadForActor(id, actor);
    if (patch.status !== undefined) await requireColumn(this.deps.columns, patch.status);
    if (patch.assignee !== undefined && patch.assignee !== issue.assignee.code) {
      await requireAssigneeIsMember(this.deps.projects, this.deps.users, issue.projectId, patch.assignee);
    }
    return this.deps.issues.update(id, patch);
  }

  async deleteIssue(id: number, actor: AuthUser): Promise<void> {
    await this.loadForActor(id, actor);
    await this.deps.issues.remove(id);
  }

  async moveIssue(id: number, payload: MoveIssuePayload, actor: AuthUser): Promise<Issue[]> {
    const issue = await this.loadForActor(id, actor);
    await requireColumn(this.deps.columns, payload.status);
    await this.deps.issues.move(id, payload.status, payload.beforeIssueId);
    const [issues, columns] = await Promise.all([
      this.deps.issues.listByProject(issue.projectId),
      this.deps.columns.list(),
    ]);
    return sortIssuesForBoard(issues, columns);
  }

  private async loadForActor(id: number, actor: AuthUser): Promise<Issue> {
    const issue = await this.deps.issues.getById(id);
    if (!issue) throw new NotFoundError(`Issue ${id} not found`);
    await requireMembership(this.deps.projects, issue.projectId, actor);
    return issue;
  }
}
