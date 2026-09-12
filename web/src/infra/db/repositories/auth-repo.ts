import type { AuthRecord, AuthRepo } from '@/domain/repositories';
import type { AuthUser } from '@/domain/types';
import { getDb, type Sql } from '../client';
import { rowToAuthUser, type UserAuthRow } from './mappers';

interface AuthRow extends UserAuthRow {
  password_hash: string | null;
}

const AUTH_SELECT =
  'id, code, username, display_name, name, role, status, avatar_color, (avatar is not null) as has_avatar';

export class PostgresAuthRepo implements AuthRepo {
  constructor(private readonly sql: Sql = getDb()) {}

  async getRecordForLogin(username: string): Promise<AuthRecord | null> {
    const rows = (await this.sql.unsafe(
      `select ${AUTH_SELECT}, password_hash from users where username = $1 limit 1`,
      [username],
    )) as unknown as AuthRow[];
    const row = rows[0];
    if (!row) return null;
    return { user: rowToAuthUser(row), passwordHash: row.password_hash };
  }

  async getUserById(id: number): Promise<AuthUser | null> {
    const rows = (await this.sql.unsafe(`select ${AUTH_SELECT} from users where id = $1 limit 1`, [
      id,
    ])) as unknown as UserAuthRow[];
    return rows[0] ? rowToAuthUser(rows[0]) : null;
  }
}
