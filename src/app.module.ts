import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import config from './config';
import { PrismaService } from './prisma.service';
import { SupabaseService } from './supabase.service';
import { AuthController, AuthService } from './auth/auth';
import { WaitlistController } from './waitlist/waitlist.controller';
import { WaitlistService } from './waitlist/waitlist.service';
import { WaitlistAdminController } from './waitlist/waitlist-admin.controller';
import { WaitlistAdminService } from './waitlist/waitlist-admin.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [AuthController, WaitlistController, WaitlistAdminController],
  providers: [
    PrismaService,
    SupabaseService,
    AuthService,
    WaitlistService,
    WaitlistAdminService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
