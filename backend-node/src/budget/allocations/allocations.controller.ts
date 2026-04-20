import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AllocationResponseDto, AllocationUpsertDto } from '../dto/allocation.dto';
import { AllocationsService } from './allocations.service';

@Controller('budget/allocations')
@UseGuards(JwtAuthGuard)
export class AllocationsController {
  constructor(private readonly allocs: AllocationsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ): Promise<AllocationResponseDto[]> {
    return this.allocs.list(user.id, year, month);
  }

  @Post()
  upsert(
    @CurrentUser() user: User,
    @Body() body: AllocationUpsertDto,
  ): Promise<AllocationResponseDto> {
    return this.allocs.upsert(user.id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.allocs.delete(user.id, id);
  }
}
