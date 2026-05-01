import { Type } from 'class-transformer';
import { IsArray, IsInt } from 'class-validator';

export class BoardGroupReorderDto {
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  ordered_ids!: number[];
}
