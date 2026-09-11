import type { UserRepo } from '@/domain/repositories';
import type { User } from '@/domain/types';
import { getDb, type Sql } from '../client';

export class PostgresUserRepo implements UserRepo {
  constructor(private readonly sql: Sql = getDb()) {}

  async list(): Promise<User[]> {
    const rows = await this.sql`select code, name, avatar_color from users order by code`;
    return rows.map((r) => ({
      code: r.code as string,
      name: r.name as string,
      avatarColor: r.avatar_color as string,
    }));
  }

  async getByCode(code: string): Promise<User | null> {
    const rows = await this
      .sql`select code, name, avatar_color from users where code = ${code} limit 1`;
    const r = rows[0];
    if (!r) return null;
    return { code: r.code as string, name: r.name as string, avatarColor: r.avatar_color as string };
  }
}
