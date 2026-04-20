import { IsInt, IsNumber, IsString, Max, Min } from 'class-validator';

export class AllocationUpsertDto {
  @IsInt()
  year!: number;

  @IsInt()
  @Min(0)
  @Max(11)
  month!: number;

  @IsString()
  category!: string;

  @IsNumber()
  limit_amount!: number;
}

export interface AllocationResponseDto {
  id: number;
  year: number;
  month: number;
  category: string;
  limit_amount: number;
  created_at: string;
}
