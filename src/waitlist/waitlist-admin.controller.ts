import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';


import { Roles, RolesGuard, SupabaseAuthGuard } from '../auth/auth';
import { WaitlistAdminService } from './waitlist-admin.service';

class UpdateWaitlistEntryDto {
  @IsOptional()
  @IsIn(['NEW', 'CONTACTED', 'INVITED', 'BETA_USER', 'LAUNCHED'])
  outreachStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  adminNotes?: string;
}

@ApiTags('CMS · Waitlist')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
@Controller('cms/waitlist')
export class WaitlistAdminController {
  constructor(private admin: WaitlistAdminService) {}

  @ApiOperation({ summary: 'Waitlist statistics: totals, 30-day series, countries, latest' })
  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @ApiOperation({ summary: 'Paginated waitlist entries with survey answers' })
  @Get()
  list(
    @Query('search') search?: string,
    @Query('locale') locale?: string,
    @Query('period') period?: string,
    @Query('sort') sort?: string,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize = 20,
  ) {
    return this.admin.list({
      search: search?.trim() || undefined,
      locale: locale === 'EN' || locale === 'AR' ? locale : undefined,
      period:
        period === 'today' || period === 'week' || period === 'month' ? period : undefined,
      sort: sort === 'oldest' ? 'oldest' : 'newest',
      status: status || undefined,
      page: Math.max(1, page),
      pageSize: Math.min(100, Math.max(1, pageSize)),
    });
  }

  @ApiOperation({ summary: 'Update outreach status / admin notes' })
  @Patch(':publicId')
  update(@Param('publicId') publicId: string, @Body() dto: UpdateWaitlistEntryDto) {
    return this.admin.update(publicId, dto);
  }

  @ApiOperation({ summary: 'Delete a waitlist entry (subscriber + survey answers)' })
  @Delete(':publicId')
  remove(@Param('publicId') publicId: string) {
    return this.admin.remove(publicId);
  }
}
