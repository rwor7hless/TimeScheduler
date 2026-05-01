import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, ValidateIf } from 'class-validator';

export class BoardReorderDto {
  // Allow null explicitly so the wire shape `{group_id: null, ordered_ids: [...]}`
  // is accepted; class-validator's `@IsOptional` would also accept undefined.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Type(() => Number)
  group_id!: number | null;

  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  ordered_ids!: number[];
}
