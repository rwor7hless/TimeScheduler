import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches } from 'class-validator';
import type { BudgetTagResponseDto } from './budget-tag.dto';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TRANSACTION_TYPES = ['expense', 'income'] as const;
export type TransactionTypeWire = (typeof TRANSACTION_TYPES)[number];

export class TransactionCreateDto {
  @IsEnum(TRANSACTION_TYPES)
  type!: TransactionTypeWire;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @Matches(DATE_RE, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  tag_ids?: number[];
}

export class TransactionUpdateDto {
  @IsOptional()
  @IsEnum(TRANSACTION_TYPES)
  type?: TransactionTypeWire;

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
  @IsString()
  @Matches(DATE_RE, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  tag_ids?: number[];
}

export interface TransactionResponseDto {
  id: number;
  type: string;
  amount: number;
  category: string | null;
  description: string;
  date: string;
  created_at: string;
  tags: BudgetTagResponseDto[];
  source_planned_id: number | null;
}
