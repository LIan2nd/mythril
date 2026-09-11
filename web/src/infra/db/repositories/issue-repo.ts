import { NotFoundError, ValidationError } from '@/domain/errors';
import type { CreateIssueInput, IssueRepo, UpdateIssueInput } from '@/domain/repositories';
import type { ColumnId, Issue } from '@/domain/types';
import type { ParameterOrJSON } from 'postgres';
import { getDb, type Sql } from '../client';
import { ISSUE_KEY_PREFIX } from '../ddl';
import { rowToChecklist, rowToIssue, type ChecklistRow, type IssueRow } from './mappers';

const SELECT_ISSUE = `
  select i.id, i.project_id, i.key, i.title, i.description, i.priority, i.type, i.status,
         i.position, i.created_at, i.updated_at,
         u.code as user_code, u.name as user_name, u.avatar_color as user_avatar_color
  from issues i left join users u on u.code = i.assignee`;

const COLUMN_ORDER = `
  case i.status
    when 'todo' then 0 when 'progress' then 1 when 'review' then 2 when 'shipped' then 3 else 4
  end`;

async function nextPosition(sql: Sql, projectId: number, status: string): Promise<number> {
  const rows =
    await sql`select coalesce(max(position), -1) + 1 as next from issues where project_id = ${projectId} and status = ${status}`;
  return Number(rows[0].next) || 0;
}

export class PostgresIssueRepo implements IssueRepo {
  constructor(private readonly sql: Sql = getDb()) {}

  async getById(id: number): Promise<Issue | null> {
    const rows = (await this.sql.unsafe(`${SELECT_ISSUE} where i.id = $1`, [id])) as unknown as IssueRow[];
    const row = rows[0];
    if (!row) return null;
    const checks = (await this.sql.unsafe(
      `select id, issue_id, text, done, position from checklist_items where issue_id = $1 order by position asc`,
      [id],
    )) as unknown as ChecklistRow[];
    return rowToIssue(row, checks.map(rowToChecklist));
  }

  async listByProject(projectId: number): Promise<Issue[]> {
    const rows = (await this.sql.unsafe(
      `${SELECT_ISSUE} where i.project_id = $1 order by ${COLUMN_ORDER}, i.position asc, i.id asc`,
      [projectId],
    )) as IssueRow[];

    const checks = (await this.sql.unsafe(
      `select c.id, c.issue_id, c.text, c.done, c.position
       from checklist_items c join issues i on i.id = c.issue_id
       where i.project_id = $1 order by c.issue_id, c.position asc`,
      [projectId],
    )) as ChecklistRow[];

    const byIssue = new Map<number, ChecklistRow[]>();
    for (const c of checks) {
      const bucket = byIssue.get(c.issue_id) ?? [];
      bucket.push(c);
      byIssue.set(c.issue_id, bucket);
    }
    return rows.map((r) => rowToIssue(r, (byIssue.get(r.id) ?? []).map(rowToChecklist)));
  }

  async create(input: CreateIssueInput): Promise<Issue> {
    const created = await this.sql.begin(async ($) => {
      const position = await nextPosition($ as unknown as Sql, input.projectId, input.status);
      const rows = (await $`
        insert into issues (project_id, key, title, description, priority, type, status, assignee, position)
        values (
          ${input.projectId},
          ${await generateKeyWith($ as unknown as Sql)},
          ${input.title},
          ${input.description ?? ''},
          ${input.priority},
          ${input.type},
          ${input.status},
          ${input.assignee},
          ${position}
        )
        returning id
      `) as unknown as { id: number }[];

      const issueId = rows[0].id;
      const texts = input.checklistTexts ?? [];
      for (const [pos, text] of texts.entries()) {
        await $`insert into checklist_items (issue_id, text, done, position) values (${issueId}, ${text}, false, ${pos})`;
      }
      return issueId;
    });
    return this.fetchById(created);
  }

  async update(id: number, patch: UpdateIssueInput): Promise<Issue> {
    await this.sql.begin(async ($) => {
      const tx = $ as unknown as Sql;
      const current = (await tx`select project_id, status from issues where id = ${id}`) as unknown as {
        project_id: number;
        status: string;
      }[];
      if (!current[0]) throw new NotFoundError(`Issue ${id} not found`);

      const moved = patch.status !== undefined && patch.status !== current[0].status;
      const position = moved ? await nextPosition(tx, current[0].project_id, patch.status!) : null;

      const sets: string[] = [];
      const params: ParameterOrJSON<never>[] = [];
      const add = (col: string, value: ParameterOrJSON<never>) => {
        params.push(value);
        sets.push(`${col} = $${params.length}`);
      };
      if (patch.title !== undefined) add('title', patch.title);
      if (patch.description !== undefined) add('description', patch.description);
      if (patch.priority !== undefined) add('priority', patch.priority);
      if (patch.type !== undefined) add('type', patch.type);
      if (patch.assignee !== undefined) add('assignee', patch.assignee);
      if (patch.status !== undefined) add('status', patch.status);
      if (position !== null) add('position', position);
      if (sets.length === 0) return;

      params.push(id);
      await tx.unsafe(`update issues set ${sets.join(', ')}, updated_at = now() where id = $${params.length}`, params);
    });
    return this.fetchById(id);
  }

  async remove(id: number): Promise<void> {
    const rows = await this.sql`delete from issues where id = ${id} returning id`;
    if (rows.length === 0) throw new NotFoundError(`Issue ${id} not found`);
  }

  async move(id: number, status: ColumnId, beforeIssueId: number | null): Promise<void> {
    await this.sql.begin(async ($) => {
      const tx = $ as unknown as Sql;
      const current = (await tx`select project_id, status from issues where id = ${id}`) as unknown as {
        project_id: number;
        status: string;
      }[];
      if (!current[0]) throw new NotFoundError(`Issue ${id} not found`);
      const projectId = current[0].project_id;

      if (beforeIssueId === id) throw new ValidationError('An issue cannot be moved before itself');
      if (beforeIssueId !== null) {
        const targets = (await tx`select id from issues where id = ${beforeIssueId} and status = ${status}`) as unknown as {
          id: number;
        }[];
        if (!targets[0]) throw new ValidationError(`Issue ${beforeIssueId} is not in column ${status}`);
      }

      const siblings = (await tx`
        select id from issues
        where project_id = ${projectId} and status = ${status} and id <> ${id}
        order by position asc, id asc
      `) as unknown as { id: number }[];

      const ids = siblings.map((r) => r.id);
      const index =
        beforeIssueId === null ? ids.length : Math.max(0, ids.findIndex((sid) => sid === beforeIssueId));
      ids.splice(index, 0, id);

      await tx`update issues set status = ${status}, updated_at = now() where id = ${id}`;
      for (const [pos, sid] of ids.entries()) {
        await tx`update issues set position = ${pos} where id = ${sid}`;
      }
    });
  }

  async generateKey(_projectKey: string): Promise<string> {
    return generateKeyWith(this.sql);
  }

  private async fetchById(id: number): Promise<Issue> {
    const issue = await this.getById(id);
    if (!issue) throw new NotFoundError(`Issue ${id} not found`);
    return issue;
  }
}

async function generateKeyWith(sql: Sql): Promise<string> {
  const rows =
    await sql`select coalesce(max((substring(key from '[0-9]+$'))::int), 0) as max from issues`;
  return `${ISSUE_KEY_PREFIX}-${Number(rows[0].max) + 1}`;
}
