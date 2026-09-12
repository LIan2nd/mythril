import { NotFoundError, ValidationError } from '@/domain/errors';
import type { ChecklistRepo, IssueRepo, ProjectRepo } from '@/domain/repositories';
import type { AuthUser, ChecklistItem } from '@/domain/types';
import { requireMembership } from './guards';

export const MAX_CHECKLIST_ITEMS = 5;

export interface ChecklistServiceDeps {
  projects: ProjectRepo;
  issues: IssueRepo;
  checklist: ChecklistRepo;
}

export class ChecklistService {
  constructor(private readonly deps: ChecklistServiceDeps) {}

  async addItem(issueId: number, text: string, actor: AuthUser): Promise<ChecklistItem> {
    const trimmed = text.trim();
    if (trimmed.length < 1 || trimmed.length > 200) throw new ValidationError('Checklist text must be 1..200 characters');
    const issue = await this.deps.issues.getById(issueId);
    if (!issue) throw new NotFoundError(`Issue ${issueId} not found`);
    await requireMembership(this.deps.projects, issue.projectId, actor);
    const items = await this.deps.checklist.listByIssue(issueId);
    if (items.length >= MAX_CHECKLIST_ITEMS) {
      throw new ValidationError(`An issue can hold at most ${MAX_CHECKLIST_ITEMS} checklist items`);
    }
    return this.deps.checklist.add(issueId, trimmed);
  }

  async toggleItem(id: number, done: boolean, actor: AuthUser): Promise<ChecklistItem> {
    const issueId = await this.deps.checklist.getIssueId(id);
    if (issueId === null) throw new NotFoundError(`Checklist item ${id} not found`);
    const issue = await this.deps.issues.getById(issueId);
    if (!issue) throw new NotFoundError(`Checklist item ${id} not found`);
    await requireMembership(this.deps.projects, issue.projectId, actor);
    return this.deps.checklist.toggle(id, done);
  }
}
