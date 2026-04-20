import { IsString, Length } from 'class-validator';

/**
 * Body of POST /api/boards. Python's `BoardCreate` requires `name: str`
 * (no length cap in the schema but the DB column is `varchar(100)`).
 * We enforce 1..100 at the API edge so we never let Prisma raise a
 * PostgreSQL string-truncation error.
 */
export class BoardCreateDto {
  @IsString()
  @Length(1, 100)
  name!: string;
}
