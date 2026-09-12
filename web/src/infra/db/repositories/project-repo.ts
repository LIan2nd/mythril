import { ConflictError, NotFoundError } from '@/domain/errors';
import type { ProjectRepo } from '@/domain/repositories';
import type { Project } from '@/domain/types';
import { getDb, type Sql } from '../client';

const PROJECT_COLS = 'id, key, name';

function toProject(row: { id: number; key: string; name: string }): Project {
  return { id: Number(row.id), key: row.key, name: row.name };
}

export class PostgresProjectRepo implements ProjectRepo {
  constructor(private readonly sql: Sql = getDb()) {}

  async list(): Promise<Project[]> {
    const rows = (await this.sql`select id, key, name from projects order by id`) as unknown as {
      id: number;
      key: string;
      name: string;
    }[];
    return rows.map(toProject);
  }

  async getByKey(key: string): Promise<Project | null> {
    const rows = (await this.sql`select id, key, name from projects where key = ${key} limit 1`) as unknown as {
      id: number; key: string; name: string;
    }[];
    return rows[0] ? toProject(rows[0]) : null;
  }

  async getById(id: number): Promise<Project | null> {
    const rows = (await this.sql`select id, key, name from projects where id = ${id} limit 1`) as unknown as {
      id: number; key: string; name: string;
    }[];
    return rows[0] ? toProject(rows[0]) : null;
  }

  async create(input: { key: string; name: string }): Promise<Project> {
    const clash = await this.sql`select 1 from projects where key = ${input.key} limit 1`;
    if (clash.length > 0) throw new ConflictError(`Project key ${input.key} already exists`);
    const rows = (await this.sql`insert into projects (key, name) values (${input.key}, ${input.name}) returning id, key, name`) as unknown as { id: number; key: string; name: string }[];
    return toProject(rows[0]);
  }

  async update(id: number, patch: { key?: string; name?: string }): Promise<Project> {
    const exists = await this.sql`select 1 from projects where id = ${id} limit 1`;
    if (exists.length === 0) throw new NotFoundError(`Project ${id} not found`);
    if (patch.key !== undefined) {
      const clash = await this.sql`select 1 from projects where key = ${patch.key} and id <> ${id} limit 1`;
      if (clash.length > 0) throw new ConflictError(`Project key ${patch.key} already exists`);
    }
    const sets: string[] = [];
    const params: string[] = [];
    if (patch.key !== undefined) {
      params.push(patch.key);
      sets.push(`key = $${params.length}`);
    }
    if (patch.name !== undefined) {
      params.push(patch.name);
      sets.push(`name = $${params.length}`);
    }
    if (sets.length === 0) {
      const project = await this.getById(id);
      if (!project) throw new NotFoundError(`Project ${id} not found`);
      return project;
    }
    params.push(String(id));
    const rows = (await this.sql.unsafe(
      `update projects set ${sets.join(', ')} where id = $${params.length}::int returning ${PROJECT_COLS}`,
      params,
    )) as unknown as { id: number; key: string; name: string }[];
    return toProject(rows[0]);
  }

  async remove(id: number): Promise<void> {
    const rows = await this.sql`delete from projects where id = ${id} returning id`;
    if (rows.length === 0) throw new NotFoundError(`Project ${id} not found`);
  }

  async countIssues(projectId: number): Promise<number> {
    const rows = await this.sql`select count(*)::int as count from issues where project_id = ${projectId}`;
    return Number(rows[0]?.count ?? 0);
  }

  async listForUser(userCode: string): Promise<Project[]> {
    const rows = (await this.sql`
      select p.id, p.key, p.name
      from projects p join project_members m on m.project_id = p.id
      where m.user_code = ${userCode}
      order by p.id
    `) as unknown as { id: number; key: string; name: string }[];
    return rows.map(toProject);
  }

  async memberCodes(projectId: number): Promise<string[]> {
    const rows = (await this.sql`
      select user_code from project_members where project_id = ${projectId} order by user_code
    `) as unknown as { user_code: string }[];
    return rows.map((r) => r.user_code);
  }

  async isMember(projectId: number, userCode: string): Promise<boolean> {
    const rows = await this.sql`
      select 1 from project_members where project_id = ${projectId} and user_code = ${userCode} limit 1
    `;
    return rows.length > 0;
  }

  async setMembers(projectId: number, codes: string[]): Promise<void> {
    const unique = [...new Set(codes)];
    await this.sql.begin(async ($: unknown) => {
      const tx = $ as Sql;
      if (unique.length === 0) {
        await tx`delete from project_members where project_id = ${projectId}`;
        return;
      }
      await tx`delete from project_members where project_id = ${projectId} and not (user_code = any(${unique}))`;
      await tx`
        insert into project_members (project_id, user_code)
        select ${projectId}, c from unnest(${unique}::text[]) as c
        on conflict (project_id, user_code) do nothing
      `;
    });
  }
}
