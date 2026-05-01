import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class BoardCreateDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  group_id?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sort_order?: number;
}
