import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NtfyModule } from '../ntfy/ntfy.module';
import { AllocationsController } from './allocations/allocations.controller';
import { AllocationsService } from './allocations/allocations.service';
import { BudgetCategoriesController } from './categories/budget-categories.controller';
import { BudgetCategoriesService } from './categories/budget-categories.service';
import { BudgetAlertsJobService } from './crons/budget-alerts-job.service';
import { BudgetRecurringJobService } from './crons/budget-recurring-job.service';
import { ExportController } from './export/export.controller';
import { HistoryController } from './history/history.controller';
import { PlannedController } from './planned/planned.controller';
import { PlannedService } from './planned/planned.service';
import { RecurringController } from './recurring/recurring.controller';
import { RecurringService } from './recurring/recurring.service';
import { SummaryController } from './summary/summary.controller';
import { SummaryService } from './summary/summary.service';
import { BudgetTagsController } from './tags/budget-tags.controller';
import { BudgetTagsService } from './tags/budget-tags.service';
import { TransactionsController } from './transactions/transactions.controller';
import { TransactionsService } from './transactions/transactions.service';
import { BudgetWeeklyService } from './weekly/budget-weekly.service';

/**
 * Phase 8 — ports `backend/app/routers/budget.py` + services. Split by
 * resource because the Python router is 787 lines and a single Nest module
 * would be unreadable. One BudgetModule re-exports BudgetWeeklyService so
 * Phase 7's WeeklyDataService can swap out its stub.
 */
@Module({
  imports: [AuthModule, NtfyModule],
  controllers: [
    BudgetTagsController,
    BudgetCategoriesController,
    AllocationsController,
    TransactionsController,
    PlannedController,
    RecurringController,
    SummaryController,
    HistoryController,
    ExportController,
  ],
  providers: [
    BudgetTagsService,
    BudgetCategoriesService,
    AllocationsService,
    TransactionsService,
    PlannedService,
    RecurringService,
    SummaryService,
    BudgetWeeklyService,
    BudgetRecurringJobService,
    BudgetAlertsJobService,
  ],
  exports: [BudgetWeeklyService],
})
export class BudgetModule {}
