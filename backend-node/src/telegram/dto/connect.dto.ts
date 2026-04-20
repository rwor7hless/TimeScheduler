import { IsString, Length } from 'class-validator';

/**
 * Body of `POST /api/telegram/connect` — a single `{key}` field. Python's
 * `ConnectRequest` in `backend/app/routers/telegram.py` is the mirror.
 */
export class ConnectDto {
  @IsString()
  @Length(1, 64)
  key!: string;
}
