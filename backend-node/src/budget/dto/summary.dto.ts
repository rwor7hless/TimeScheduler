export interface SummaryTotalsDto {
  income: number;
  expense: number;
  balance: number;
  planned_pending: number;
  planned_done: number;
}

export interface SummaryCategoryDto {
  category: string | null;
  allocated: number;
  spent: number;
  planned_pending: number;
  remaining: number;
  pct: number;
}

export interface SummaryDayDto {
  date: string;
  expense: number;
  income: number;
}

export interface SummaryTrendDto {
  prev_expense: number;
  delta_abs: number;
  delta_pct: number | null;
}

export interface SummaryProjectionDto {
  days_passed: number;
  days_total: number;
  days_left: number;
  rate_per_day: number;
  projected_total: number;
  daily_budget: number;
}

export interface SummaryResponseDto {
  year: number;
  month: number;
  totals: SummaryTotalsDto;
  by_category: SummaryCategoryDto[];
  daily: SummaryDayDto[];
  trend: SummaryTrendDto;
  projection: SummaryProjectionDto;
}
