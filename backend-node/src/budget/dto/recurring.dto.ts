import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { TRANSACTION_TYPES, TransactionTypeWire } from './transaction.dto';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class RecurringCreateDto {
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

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  tag_ids?: number[];

  @IsInt()
  @Min(1, { message: 'day_of_month must be 1..31' })
  @Max(31, { message: 'day_of_month must be 1..31' })
  day_of_month!: number;

  @IsString()
  @Matches(DATE_RE, { message: 'start_date must be YYYY-MM-DD' })
  start_date!: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_RE, { message: 'end_date must be YYYY-MM-DD' })
  end_date?: string | null;

  @IsOptional()
  @IsBoolean()
  is_paused?: boolean;
}

export class RecurringUpdateDto {
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
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  tag_ids?: number[];

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'day_of_month must be 1..31' })
  @Max(31, { message: 'day_of_month must be 1..31' })
  day_of_month?: number;

  @IsOptional()
  @IsString()
  @Matches(DATE_RE, { message: 'start_date must be YYYY-MM-DD' })
  start_date?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_RE, { message: 'end_date must be YYYY-MM-DD' })
  end_date?: string | null;

  @IsOptional()
  @IsBoolean()
  is_paused?: boolean;
}

export interface RecurringResponseDto {
  id: number;
  type: string;
  amount: number;
  category: string | null;
  description: string;
  tag_ids: number[];
  day_of_month: number;
  start_date: string;
  end_date: string | null;
  last_generated_date: string | null;
  is_paused: boolean;
  created_at: string;
}
