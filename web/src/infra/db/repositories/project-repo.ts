import type { Project } from '@/domain/types';
import type { ProjectRepo } from '@/domain/repositories';
import { getDb, type Sql } from '../client';

export class PostgresProjectRepo implements ProjectRepo {
  constructor(private readonly sql: Sql = getDb()) {}

  async list(): Promise<Project[]> {
    return this.sql`select id, key, name from projects order by id` as unknown as Project[];
  }

  async getByKey(key: string): Promise<Project | null> {
    const rows = await this
      .sql`select id, key, name from projects where key = ${key} limit 1`;
    return (rows[0] as unknown as Project | undefined) ?? null;
  }
}
