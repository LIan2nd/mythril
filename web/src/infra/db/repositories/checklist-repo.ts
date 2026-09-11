import { NotFoundError } from '@/domain/errors';
import type { ChecklistRepo } from '@/domain/repositories';
import type { ChecklistItem } from '@/domain/types';
import { getDb, type Sql } from '../client';
import { rowToChecklist, type ChecklistRow } from './mappers';

export class PostgresChecklistRepo implements ChecklistRepo {
  constructor(private readonly sql: Sql = getDb()) {}

  async add(issueId: number, text: string): Promise<ChecklistItem> {
    const rows = (await this.sql`
      insert into checklist_items (issue_id, text, done, position)
      select ${issueId}, ${text}, false, coalesce(max(c.position), -1) + 1
      from checklist_items c where c.issue_id = ${issueId}
      returning id, issue_id, text, done, position
    `) as unknown as ChecklistRow[];
    const row = rows[0];
    if (!row) throw new NotFoundError(`Issue ${issueId} not found`);
    return rowToChecklist(row);
  }

  async toggle(id: number, done: boolean): Promise<ChecklistItem> {
    const rows = (await this.sql`
      update checklist_items set done = ${done} where id = ${id}
      returning id, issue_id, text, done, position
    `) as unknown as ChecklistRow[];
    const row = rows[0];
    if (!row) throw new NotFoundError(`Checklist item ${id} not found`);
    return rowToChecklist(row);
  }

  async listByIssue(issueId: number): Promise<ChecklistItem[]> {
    const rows = (await this.sql`
      select id, issue_id, text, done, position
      from checklist_items where issue_id = ${issueId} order by position asc
    `) as unknown as ChecklistRow[];
    return rows.map(rowToChecklist);
  }
}
