import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SummaryResponseDto } from '../dto/summary.dto';
import { SummaryService } from './summary.service';

@Controller('budget/summary')
@UseGuards(JwtAuthGuard)
export class SummaryController {
  constructor(private readonly summary: SummaryService) {}

  @Get()
  build(
    @CurrentUser() user: User,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ): Promise<SummaryResponseDto> {
    return this.summary.build(user.id, year, month);
  }
}
