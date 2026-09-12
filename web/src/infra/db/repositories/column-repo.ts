import { NotFoundError } from '@/domain/errors';
import type { BoardColumnRepo } from '@/domain/repositories';
import type { BoardColumn, ColumnColor, ColumnKind } from '@/domain/types';
import { getDb, type Sql } from '../client';

interface ColumnRow {
  key: string;
  label: string;
  kind: string;
  color: string;
  position: number;
}

function rowToColumn(row: ColumnRow): BoardColumn {
  return {
    key: row.key,
    label: row.label,
    kind: row.kind as ColumnKind,
    color: row.color as ColumnColor,
    position: Number(row.position),
  };
}

const COLUMNS = 'key, label, kind, color, position';

export class PostgresBoardColumnRepo implements BoardColumnRepo {
  constructor(private readonly sql: Sql = getDb()) {}

  async list(): Promise<BoardColumn[]> {
    const rows = (await this.sql.unsafe(
      `select ${COLUMNS} from board_columns order by position asc, key asc`,
    )) as unknown as ColumnRow[];
    return rows.map(rowToColumn);
  }

  async getByKey(key: string): Promise<BoardColumn | null> {
    const rows = (await this.sql.unsafe(`select ${COLUMNS} from board_columns where key = $1 limit 1`, [
      key,
    ])) as unknown as ColumnRow[];
    return rows[0] ? rowToColumn(rows[0]) : null;
  }

  async create(input: {
    key: string;
    label: string;
    kind: ColumnKind;
    color: ColumnColor;
    beforeKey: string | null;
  }): Promise<BoardColumn> {
    await this.sql.begin(async ($: unknown) => {
      const tx = $ as Sql;
      const anchor = input.beforeKey
        ? ((await tx`select position from board_columns where key = ${input.beforeKey} limit 1`) as unknown as {
            position: number;
          }[])[0]
        : undefined;
      const position = anchor
        ? Number(anchor.position)
        : Number(
            (
              (await tx`select coalesce(max(position), -1) + 1 as next from board_columns`) as unknown as {
                next: number;
              }[]
            )[0].next,
          );
      if (anchor) {
        await tx`update board_columns set position = position + 1 where position >= ${position}`;
      }
      await tx`
        insert into board_columns (key, label, kind, color, position)
        values (${input.key}, ${input.label}, ${input.kind}, ${input.color}, ${position})
      `;
    });
    const column = await this.getByKey(input.key);
    if (!column) throw new NotFoundError(`Column ${input.key} not found`);
    return column;
  }

  async update(key: string, patch: { label?: string; kind?: ColumnKind; color?: ColumnColor }): Promise<BoardColumn> {
    const sets: string[] = [];
    const params: string[] = [];
    const add = (col: string, value: string | undefined) => {
      if (value === undefined) return;
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    add('label', patch.label);
    add('kind', patch.kind);
    add('color', patch.color);
    if (sets.length === 0) {
      const existing = await this.getByKey(key);
      if (!existing) throw new NotFoundError(`Column ${key} not found`);
      return existing;
    }
    params.push(key);
    const rows = (await this.sql.unsafe(
      `update board_columns set ${sets.join(', ')} where key = $${params.length} returning ${COLUMNS}`,
      params,
    )) as unknown as ColumnRow[];
    if (rows.length === 0) throw new NotFoundError(`Column ${key} not found`);
    return rowToColumn(rows[0]);
  }

  async reorder(orderedKeys: string[]): Promise<BoardColumn[]> {
    await this.sql.begin(async ($: unknown) => {
      const tx = $ as Sql;
      for (const [position, key] of orderedKeys.entries()) {
        await tx`update board_columns set position = ${position} where key = ${key}`;
      }
    });
    return this.list();
  }

  async remove(key: string): Promise<void> {
    const rows = await this.sql`delete from board_columns where key = ${key} returning key`;
    if (rows.length === 0) throw new NotFoundError(`Column ${key} not found`);
  }
}
