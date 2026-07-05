import {
  CanActivate,
  Controller,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Post,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PrismaService } from '../prisma.service';
import { SupabaseService } from '../supabase.service';

/** Compact auth stack for the standalone waitlist service: Supabase token →
 *  app user (with roles) → admin-only route guarding. */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user,
);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

type UserWithRoles = {
  id: bigint;
  email: string;
  name: string;
  deletedAt: Date | null;
  roles: { role: { key: string } }[];
};

const USER_INCLUDE = { roles: { include: { role: true } } } as const;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
  ) {}

  /** Validates the token and resolves the matching app user (read-only: this
   *  service never creates users — signup happens on the main platform). */
  async userFromToken(token: string): Promise<AuthUser | null> {
    const supabaseUser = await this.supabase.getUser(token);
    if (!supabaseUser?.email) return null;

    const user = (await this.prisma.user.findFirst({
      where: {
        OR: [{ authProviderId: supabaseUser.id }, { email: supabaseUser.email }],
        deletedAt: null,
      },
      include: USER_INCLUDE,
    })) as UserWithRoles | null;
    if (!user) return null;

    return {
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      roles: user.roles.map((r) => r.role.key),
    };
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = extractBearer(req);
    if (!token) throw new UnauthorizedException('Missing access token.');
    const user = await this.auth.userFromToken(token);
    if (!user) throw new UnauthorizedException('Invalid or expired session.');
    req.user = user;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user || !required.some((r) => user.roles.includes(r))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  @ApiOperation({ summary: 'Current user profile + roles (used by the admin dashboard gate)' })
  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @ApiOperation({ summary: 'Session ping (kept for frontend compatibility)' })
  @UseGuards(SupabaseAuthGuard)
  @Post('sync')
  sync(@CurrentUser() user: AuthUser) {
    return user;
  }
}
