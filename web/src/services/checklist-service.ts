import { NotFoundError, ValidationError } from '@/domain/errors';
import type { ChecklistRepo, IssueRepo } from '@/domain/repositories';
import type { ChecklistItem } from '@/domain/types';

export const MAX_CHECKLIST_ITEMS = 5;

export interface ChecklistServiceDeps {
  issues: IssueRepo;
  checklist: ChecklistRepo;
}

export class ChecklistService {
  constructor(private readonly deps: ChecklistServiceDeps) {}

  async addItem(issueId: number, text: string): Promise<ChecklistItem> {
    const trimmed = text.trim();
    if (trimmed.length < 1 || trimmed.length > 200) throw new ValidationError('Checklist text must be 1..200 characters');
    const issue = await this.deps.issues.getById(issueId);
    if (!issue) throw new NotFoundError(`Issue ${issueId} not found`);
    const items = await this.deps.checklist.listByIssue(issueId);
    if (items.length >= MAX_CHECKLIST_ITEMS) {
      throw new ValidationError(`An issue can hold at most ${MAX_CHECKLIST_ITEMS} checklist items`);
    }
    return this.deps.checklist.add(issueId, trimmed);
  }

  toggleItem(id: number, done: boolean): Promise<ChecklistItem> {
    return this.deps.checklist.toggle(id, done);
  }
}
