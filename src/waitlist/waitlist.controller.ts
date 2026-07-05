import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WaitlistService } from './waitlist.service';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { WaitlistProfileDto } from './dto/waitlist-profile.dto';

@ApiTags('Waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private waitlist: WaitlistService) {}

  @ApiOperation({ summary: 'Join the pre-launch waitlist (public)' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  join(@Body() dto: JoinWaitlistDto) {
    return this.waitlist.join(dto);
  }

  @ApiOperation({ summary: 'Save the optional post-signup survey (public)' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('profile')
  saveProfile(@Body() dto: WaitlistProfileDto) {
    return this.waitlist.saveProfile(dto);
  }
}
