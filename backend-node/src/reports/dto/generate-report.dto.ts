import { IsOptional, Matches } from 'class-validator';

export class GenerateReportDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'week_start должен быть YYYY-MM-DD' })
  week_start?: string;
}
