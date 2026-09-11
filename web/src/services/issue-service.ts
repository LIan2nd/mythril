import { NotFoundError, ValidationError } from '@/domain/errors';
import type { IssueRepo, ProjectRepo, UserRepo } from '@/domain/repositories';
import type { CreateIssuePayload, Issue, MoveIssuePayload, UpdateIssuePayload } from '@/domain/types';
import { sortIssuesForBoard } from '@/domain/types';

export const DEFAULT_CHECKLIST = ['Define scope', 'Add test'];

function validateTitle(title: string): void {
  const len = title.trim().length;
  if (len < 1 || len > 120) throw new ValidationError('Title must be 1..120 characters');
}

export interface IssueServiceDeps {
  projects: ProjectRepo;
  users: UserRepo;
  issues: IssueRepo;
}

export class IssueService {
  constructor(private readonly deps: IssueServiceDeps) {}

  async createIssue(projectKey: string, payload: CreateIssuePayload): Promise<Issue> {
    validateTitle(payload.title);
    const texts = payload.checklistTexts?.filter((t) => t.trim().length > 0) ?? [];
    if (texts.length > 5) throw new ValidationError('Checklist is limited to 5 items');

    const project = await this.deps.projects.getByKey(projectKey);
    if (!project) throw new NotFoundError(`Project ${projectKey} not found`);
    const assignee = await this.deps.users.getByCode(payload.assignee);
    if (!assignee) throw new ValidationError(`Unknown assignee ${payload.assignee}`);

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

  async updateIssue(id: number, patch: UpdateIssuePayload): Promise<Issue> {
    if (patch.title !== undefined) validateTitle(patch.title);
    if (patch.assignee !== undefined) {
      const user = await this.deps.users.getByCode(patch.assignee);
      if (!user) throw new ValidationError(`Unknown assignee ${patch.assignee}`);
    }
    return this.deps.issues.update(id, patch);
  }

  async deleteIssue(id: number): Promise<void> {
    await this.deps.issues.remove(id);
  }

  async moveIssue(id: number, payload: MoveIssuePayload): Promise<Issue[]> {
    const issue = await this.deps.issues.getById(id);
    if (!issue) throw new NotFoundError(`Issue ${id} not found`);
    await this.deps.issues.move(id, payload.status, payload.beforeIssueId);
    const issues = await this.deps.issues.listByProject(issue.projectId);
    return sortIssuesForBoard(issues);
  }
}
