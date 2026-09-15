import type { SprintRepo, UpsertSprintInput } from '@/domain/repositories';
import type { Sprint } from '@/domain/types';
import { getDb, type Sql } from '../client';

function daysBetween(end: string): number {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const endDay = new Date(`${end}T00:00:00Z`);
  return Math.max(0, Math.ceil((endDay.getTime() - today.getTime()) / 86_400_000));
}

export class PostgresSprintRepo implements SprintRepo {
  constructor(private readonly sql: Sql = getDb()) {}

  async getActiveForProject(projectId: number): Promise<Sprint | null> {
    const rows = await this.sql`
      select id, number, kicker, title, starts_at, ends_at
      from sprints
      where project_id = ${projectId} and is_active
      order by number desc
      limit 1
    `;
    const row = rows[0] as
      | { id: number; number: number; kicker: string | null; title: string | null; starts_at: Date | string; ends_at: Date | string }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      number: row.number,
      kicker: row.kicker ?? '',
      title: row.title ?? '',
      startsAt: toDateStr(row.starts_at),
      endsAt: toDateStr(row.ends_at),
      daysLeft: daysBetween(toDateStr(row.ends_at)),
    };
  }

  async upsertActiveForProject(projectId: number, input: UpsertSprintInput): Promise<Sprint> {
    const isActive = input.isActive ?? true;
    if (isActive) {
      await this.sql`
        update sprints
        set is_active = false
        where project_id = ${projectId} and number != ${input.number}
      `;
    }

    const rows = await this.sql`
      insert into sprints (project_id, number, kicker, title, starts_at, ends_at, is_active)
      values (
        ${projectId},
        ${input.number},
        ${input.kicker ?? `Sprint #${input.number}`},
        ${input.title ?? 'Forge the sprint. Ship like legend.'},
        ${input.startsAt}::date,
        ${input.endsAt}::date,
        ${isActive}
      )
      on conflict (project_id, number) do update set
        kicker = excluded.kicker,
        title = excluded.title,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        is_active = excluded.is_active
      returning id, number, kicker, title, starts_at, ends_at
    `;
    const row = rows[0] as {
      id: number;
      number: number;
      kicker: string | null;
      title: string | null;
      starts_at: Date | string;
      ends_at: Date | string;
    };
    return {
      id: row.id,
      number: row.number,
      kicker: row.kicker ?? '',
      title: row.title ?? '',
      startsAt: toDateStr(row.starts_at),
      endsAt: toDateStr(row.ends_at),
      daysLeft: daysBetween(toDateStr(row.ends_at)),
    };
  }
}

function toDateStr(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
