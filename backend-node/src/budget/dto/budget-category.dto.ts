import { IsBoolean, IsInt, IsOptional, IsString, Length } from 'class-validator';

export class BudgetCategoryCreateDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  key?: string;

  @IsString()
  @Length(1, 50)
  label!: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}

export class BudgetCategoryUpdateDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  label?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_archived?: boolean;
}

export interface BudgetCategoryResponseDto {
  id: number;
  key: string;
  label: string;
  icon: string;
  color: string;
  sort_order: number;
  is_archived: boolean;
}
