import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchResult, SearchService } from './search.service';

/**
 * `/api/search?q=...` — ports `backend/app/routers/search.py`.
 * `q` is required, 1..200 chars (mirrors the Python `Query(min_length=1,
 * max_length=200)`).
 */
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  do(@CurrentUser() user: User, @Query('q') q?: string): Promise<SearchResult> {
    if (!q || q.length < 1) {
      throw new BadRequestException('q is required');
    }
    if (q.length > 200) {
      throw new BadRequestException('q must be at most 200 chars');
    }
    return this.search.search(user.id, q);
  }
}
