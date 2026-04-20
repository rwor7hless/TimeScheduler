import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type { BudgetTagResponseDto } from './budget-tag.dto';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class PlannedPurchaseCreateDto {
  @IsInt()
  year!: number;

  @IsInt()
  @Min(0)
  @Max(11)
  month!: number;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  tag_ids?: number[];
}

export class PlannedPurchaseUpdateDto {
  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  tag_ids?: number[];
}

export class PlannedConvertRequestDto {
  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  @Matches(DATE_RE, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  tag_ids?: number[];
}

export interface PlannedPurchaseResponseDto {
  id: number;
  year: number;
  month: number;
  amount: number;
  category: string | null;
  description: string;
  done: boolean;
  created_at: string;
  tags: BudgetTagResponseDto[];
  source_recurring_id: number | null;
}
