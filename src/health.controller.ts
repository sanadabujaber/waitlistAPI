import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Liveness probe (used by the hosting platform)' })
  @Get()
  check() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
