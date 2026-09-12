import { ConflictError, NotFoundError } from '@/domain/errors';
import type { AdminUserPatch, NewUserInput, UserProfilePatch, UserRepo } from '@/domain/repositories';
import type { AuthUser, User } from '@/domain/types';
import { getDb, type Sql } from '../client';
import { rowToAuthUser, type UserAuthRow } from './mappers';

const AUTH_COLUMNS =
  'id, code, username, display_name, name, role, status, avatar_color, (avatar is not null) as has_avatar';

function rowToLegacyUser(r: { code: string; name: string; avatar_color: string }): User {
  return { code: r.code, name: r.name, avatarColor: r.avatar_color };
}

export class PostgresUserRepo implements UserRepo {
  constructor(private readonly sql: Sql = getDb()) {}

  async list(): Promise<User[]> {
    const rows = (await this.sql`select code, name, avatar_color from users order by code`) as unknown as {
      code: string; name: string; avatar_color: string;
    }[];
    return rows.map(rowToLegacyUser);
  }

  async getByCode(code: string): Promise<User | null> {
    const rows = (await this.sql`select code, name, avatar_color from users where code = ${code} limit 1`) as unknown as {
      code: string; name: string; avatar_color: string;
    }[];
    return rows[0] ? rowToLegacyUser(rows[0]) : null;
  }

  async listAuth(): Promise<AuthUser[]> {
    const rows = (await this.sql.unsafe(`select ${AUTH_COLUMNS} from users order by code`)) as unknown as UserAuthRow[];
    return rows.map(rowToAuthUser);
  }

  async listAuthByCodes(codes: string[]): Promise<AuthUser[]> {
    if (codes.length === 0) return [];
    const rows = (await this.sql.unsafe(
      `select ${AUTH_COLUMNS} from users where code = any($1::text[]) order by code`,
      [codes],
    )) as unknown as UserAuthRow[];
    return rows.map(rowToAuthUser);
  }

  async getAuthByUsername(username: string): Promise<AuthUser | null> {
    const rows = (await this.sql.unsafe(
      `select ${AUTH_COLUMNS} from users where username = $1 limit 1`,
      [username],
    )) as unknown as UserAuthRow[];
    return rows[0] ? rowToAuthUser(rows[0]) : null;
  }

  async create(input: NewUserInput): Promise<AuthUser> {
    const clash = await this.sql`
      select 1 from users where code = ${input.code} or username = ${input.username} limit 1
    `;
    if (clash.length > 0) throw new ConflictError(`User ${input.username} already exists`);
    const rows = (await this.sql.unsafe(
      `insert into users (code, name, avatar_color, username, password_hash, role, status, display_name)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning ${AUTH_COLUMNS}`,
      [
        input.code,
        input.displayName,
        input.color,
        input.username,
        input.passwordHash,
        input.role,
        input.status,
        input.displayName,
      ],
    )) as unknown as UserAuthRow[];
    return rowToAuthUser(rows[0]);
  }

  async updateProfile(id: number, patch: UserProfilePatch): Promise<AuthUser> {
    const exists = await this.sql`select 1 from users where id = ${id} limit 1`;
    if (exists.length === 0) throw new NotFoundError(`User ${id} not found`);
    if (patch.username !== undefined) {
      const taken = await this.sql`select 1 from users where username = ${patch.username} and id <> ${id} limit 1`;
      if (taken.length > 0) throw new ConflictError(`Username ${patch.username} is already taken`);
    }
    return this.applyPatch(id, [
      ['username', patch.username],
      ['display_name', patch.displayName],
      ['name', patch.displayName],
      ['avatar_color', patch.color],
    ]);
  }

  async adminPatch(id: number, patch: AdminUserPatch): Promise<AuthUser> {
    const current = (await this.sql`select code from users where id = ${id} limit 1`) as unknown as { code: string }[];
    if (current.length === 0) throw new NotFoundError(`User ${id} not found`);
    const nextCode = patch.code;
    if (nextCode && nextCode !== current[0].code) {
      const taken = await this.sql`select 1 from users where code = ${nextCode} and id <> ${id} limit 1`;
      if (taken.length > 0) throw new ConflictError(`Code ${nextCode} is already taken`);
      const oldCode = current[0].code;
      await this.sql.begin(async ($) => {
        await $`update issues set assignee = ${nextCode} where assignee = ${oldCode}`;
        await $`update project_members set user_code = ${nextCode} where user_code = ${oldCode}`;
        await $.unsafe(`update users set code = $1 where id = $2`, [nextCode, id]);
      });
    }
    return this.applyPatch(id, [
      ['role', patch.role],
      ['status', patch.status],
      ['display_name', patch.displayName],
      ['name', patch.displayName],
      ['avatar_color', patch.color],
      ['password_hash', patch.passwordHash],
    ]);
  }

  async updatePassword(id: number, passwordHash: string): Promise<void> {
    const rows = await this.sql`update users set password_hash = ${passwordHash} where id = ${id} returning id`;
    if (rows.length === 0) throw new NotFoundError(`User ${id} not found`);
  }

  async setAvatar(id: number, avatar: Uint8Array | null, avatarType: string | null): Promise<AuthUser> {
    const blob = avatar === null ? null : Buffer.from(avatar);
    const rows = (await this.sql.unsafe(
      `update users set avatar = $1, avatar_type = $2, avatar_updated_at = now()
       where id = $3
       returning ${AUTH_COLUMNS}`,
      [blob, avatarType, id],
    )) as unknown as UserAuthRow[];
    if (rows.length === 0) throw new NotFoundError(`User ${id} not found`);
    return rowToAuthUser(rows[0]);
  }

  async getAvatarByCode(code: string): Promise<{ data: Uint8Array; type: string; updatedAt: string | null } | null> {
    const rows = await this.sql`
      select avatar, avatar_type, avatar_updated_at from users
      where code = ${code} and avatar is not null limit 1
    `;
    const row = rows[0] as { avatar: Buffer; avatar_type: string | null; avatar_updated_at: Date | null } | undefined;
    if (!row || !row.avatar) return null;
    return {
      data: row.avatar,
      type: row.avatar_type ?? 'application/octet-stream',
      updatedAt: row.avatar_updated_at instanceof Date ? row.avatar_updated_at.toISOString() : null,
    };
  }

  async remove(id: number): Promise<void> {
    const rows = await this.sql`delete from users where id = ${id} returning id`;
    if (rows.length === 0) throw new NotFoundError(`User ${id} not found`);
  }

  private async applyPatch(id: number, columns: [string, unknown][]): Promise<AuthUser> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [col, value] of columns) {
      if (value === undefined) continue;
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    }
    if (sets.length === 0) return this.fetchAuth(id);
    params.push(id);
    const rows = (await this.sql.unsafe(
      `update users set ${sets.join(', ')} where id = $${params.length} returning ${AUTH_COLUMNS}`,
      params as never,
    )) as unknown as UserAuthRow[];
    if (rows.length === 0) throw new NotFoundError(`User ${id} not found`);
    return rowToAuthUser(rows[0]);
  }

  private async fetchAuth(id: number): Promise<AuthUser> {
    const rows = (await this.sql.unsafe(`select ${AUTH_COLUMNS} from users where id = $1`, [
      id,
    ])) as unknown as UserAuthRow[];
    if (rows.length === 0) throw new NotFoundError(`User ${id} not found`);
    return rowToAuthUser(rows[0]);
  }
}
