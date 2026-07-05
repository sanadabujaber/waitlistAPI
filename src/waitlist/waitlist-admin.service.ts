import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export interface WaitlistListQuery {
  search?: string;
  locale?: 'EN' | 'AR';
  period?: 'today' | 'week' | 'month';
  sort?: 'newest' | 'oldest';
  status?: string;
  page: number;
  pageSize: number;
}

/** Start of the current UTC day, minus `days` days. */
function utcDayStart(daysAgo = 0): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo),
  );
}

const OUTREACH_STATUSES = ['NEW', 'CONTACTED', 'INVITED', 'BETA_USER', 'LAUNCHED'] as const;
type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

@Injectable()
export class WaitlistAdminService {
  constructor(private prisma: PrismaService) {}

  async stats() {
    const today = utcDayStart();
    const weekAgo = utcDayStart(7);
    const monthAgo = utcDayStart(30);

    const [
      total,
      todayCount,
      week,
      month,
      en,
      ar,
      latest,
      recent,
      countries,
      surveyCount,
      roles,
      goals,
      interestRows,
    ] = await Promise.all([
        this.prisma.newsletterSubscriber.count(),
        this.prisma.newsletterSubscriber.count({ where: { createdAt: { gte: today } } }),
        this.prisma.newsletterSubscriber.count({ where: { createdAt: { gte: weekAgo } } }),
        this.prisma.newsletterSubscriber.count({ where: { createdAt: { gte: monthAgo } } }),
        this.prisma.newsletterSubscriber.count({ where: { locale: 'EN' } }),
        this.prisma.newsletterSubscriber.count({ where: { locale: 'AR' } }),
        this.prisma.newsletterSubscriber.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { publicId: true, email: true, name: true, locale: true, createdAt: true },
        }),
        // Raw rows for the 30-day series; grouped in JS to stay DB-portable.
        this.prisma.newsletterSubscriber.findMany({
          where: { createdAt: { gte: monthAgo } },
          select: { createdAt: true },
        }),
        this.prisma.waitlistProfile.groupBy({
          by: ['country'],
          _count: { _all: true },
          where: { country: { not: null } },
          orderBy: { _count: { country: 'desc' } },
          take: 10,
        }),
        this.prisma.waitlistProfile.count(),
        this.prisma.waitlistProfile.groupBy({
          by: ['role'],
          _count: { _all: true },
          where: { role: { not: null } },
          orderBy: { _count: { role: 'desc' } },
          take: 10,
        }),
        this.prisma.waitlistProfile.groupBy({
          by: ['primaryGoal'],
          _count: { _all: true },
          where: { primaryGoal: { not: null } },
          orderBy: { _count: { primaryGoal: 'desc' } },
          take: 10,
        }),
        // Interests are a string[]; counted in JS below.
        this.prisma.waitlistProfile.findMany({ select: { interests: true } }),
      ]);

    const interestCounts = new Map<string, number>();
    for (const row of interestRows) {
      for (const i of row.interests) interestCounts.set(i, (interestCounts.get(i) ?? 0) + 1);
    }
    const interests = [...interestCounts.entries()]
      .map(([interest, count]) => ({ interest, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Build a continuous 30-day series (zero-filled).
    const series: { date: string; count: number }[] = [];
    const byDay = new Map<string, number>();
    for (const r of recent) {
      const key = r.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    for (let i = 29; i >= 0; i--) {
      const key = utcDayStart(i).toISOString().slice(0, 10);
      series.push({ date: key, count: byDay.get(key) ?? 0 });
    }

    return {
      total,
      today: todayCount,
      week,
      month,
      en,
      ar,
      series,
      countries: countries.map((c: any) => ({ country: c.country as string, count: c._count._all })),
      latest,
      survey: {
        responses: surveyCount,
        roles: roles.map((r: any) => ({ role: r.role as string, count: r._count._all })),
        goals: goals.map((g: any) => ({ goal: g.primaryGoal as string, count: g._count._all })),
        interests,
      },
    };
  }

  async list(q: WaitlistListQuery) {
    const where: Record<string, any> = {};
    if (q.locale) where.locale = q.locale;
    if (q.status && (OUTREACH_STATUSES as readonly string[]).includes(q.status)) {
      where.outreachStatus = q.status as OutreachStatus;
    }
    if (q.period) {
      const days = q.period === 'today' ? 0 : q.period === 'week' ? 7 : 30;
      where.createdAt = { gte: utcDayStart(days) };
    }
    if (q.search) {
      where.OR = [
        { email: { contains: q.search, mode: 'insensitive' } },
        { name: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.newsletterSubscriber.count({ where }),
      this.prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: q.sort === 'oldest' ? 'asc' : 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          publicId: true,
          email: true,
          name: true,
          locale: true,
          status: true,
          outreachStatus: true,
          adminNotes: true,
          source: true,
          createdAt: true,
        },
      }),
    ]);

    // Attach survey answers (WaitlistProfile) for the page's rows in one query.
    const profiles = (await this.prisma.waitlistProfile.findMany({
      where: { email: { in: rows.map((r: any) => r.email) } },
      select: {
        email: true,
        name: true,
        role: true,
        interests: true,
        primaryGoal: true,
        country: true,
        challenge: true,
      },
    })) as Array<{
      email: string;
      name: string | null;
      role: string | null;
      interests: string[];
      primaryGoal: string | null;
      country: string | null;
      challenge: string | null;
    }>;
    const profileByEmail = new Map(profiles.map((p) => [p.email, p]));

    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      rows: rows.map((r: any) => {
        const p = profileByEmail.get(r.email);
        return {
          id: r.publicId,
          email: r.email,
          name: r.name ?? p?.name ?? null,
          locale: r.locale,
          status: r.status,
          outreachStatus: r.outreachStatus,
          adminNotes: r.adminNotes,
          source: r.source,
          createdAt: r.createdAt,
          profile: p
            ? {
                role: p.role,
                interests: p.interests,
                primaryGoal: p.primaryGoal,
                country: p.country,
                challenge: p.challenge,
              }
            : null,
        };
      }),
    };
  }

  async update(publicId: string, data: { outreachStatus?: string; adminNotes?: string }) {
    const sub = await this.prisma.newsletterSubscriber.findUnique({ where: { publicId } });
    if (!sub) throw new NotFoundException('Subscriber not found');

    const updated = await this.prisma.newsletterSubscriber.update({
      where: { id: sub.id },
      data: {
        ...(data.outreachStatus &&
        (OUTREACH_STATUSES as readonly string[]).includes(data.outreachStatus)
          ? { outreachStatus: data.outreachStatus as OutreachStatus }
          : {}),
        ...(data.adminNotes !== undefined ? { adminNotes: data.adminNotes.trim() || null } : {}),
      },
      select: { publicId: true, outreachStatus: true, adminNotes: true },
    });
    return updated;
  }

  async remove(publicId: string) {
    const sub = await this.prisma.newsletterSubscriber.findUnique({ where: { publicId } });
    if (!sub) throw new NotFoundException('Subscriber not found');
    await this.prisma.$transaction([
      this.prisma.waitlistProfile.deleteMany({ where: { email: sub.email } }),
      this.prisma.newsletterSubscriber.delete({ where: { id: sub.id } }),
    ]);
    return { success: true };
  }
}
