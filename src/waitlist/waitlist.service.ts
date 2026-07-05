import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma.service';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { WaitlistProfileDto } from './dto/waitlist-profile.dto';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) { }

  /**
   * Pre-launch waitlist signup. Idempotent — re-subscribing the same email
   * just refreshes the row, and the response never reveals whether the email
   * was already on the list.
   */
  async join(dto: JoinWaitlistDto) {
    // Honeypot tripped → pretend success, store nothing, send nothing.
    if (dto.website) return { success: true };

    const email = dto.email.trim().toLowerCase();
    const locale = dto.locale ?? 'EN';

    const existing = await this.prisma.newsletterSubscriber.findUnique({ where: { email } });

    if (existing && existing.status === 'ACTIVE') {
      throw new BadRequestException(
        locale === 'AR'
          ? 'هذا البريد الإلكتروني مسجل بالفعل.'
          : 'This email is already registered.'
      );
    }

    await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      update: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        locale,
        status: 'ACTIVE',
        unsubscribedAt: null,
        source: 'prelaunch',
      },
      create: {
        email,
        name: dto.name?.trim() ?? null,
        locale,
        status: 'ACTIVE',
        confirmedAt: new Date(),
        source: 'prelaunch',
      },
    });

    // Only email on the first signup, not on repeats.
    if (!existing) await this.sendConfirmation(email, dto.name?.trim(), locale);
    return { success: true };
  }

  /** Optional post-signup survey — upserted by email, all answers optional. */
  async saveProfile(dto: WaitlistProfileDto) {
    const email = dto.email.trim().toLowerCase();
    const data = {
      name: dto.name?.trim() || null,
      role: dto.role?.trim() || null,
      interests: dto.interests ?? [],
      primaryGoal: dto.primaryGoal?.trim() || null,
      country: dto.country?.trim() || null,
      challenge: dto.challenge?.trim() || null,
      locale: dto.locale ?? 'EN',
    } as const;

    await this.prisma.waitlistProfile.upsert({
      where: { email },
      update: data,
      create: { email, ...data },
    });
    return { success: true };
  }

  private async sendConfirmation(email: string, name: string | undefined, locale: 'EN' | 'AR') {
    const en = {
      subject: "You're officially on the waitlist",
      greeting: name ? `Hi ${name},` : "Hi,",
      body: [
        "Welcome to the Sanad Platform waitlist.",
        "I'm building a platform that brings together AI, productivity tools, and practical content in one place.",
        "You'll be among the first to receive access when we launch.",
        "Thanks for joining, and see you soon."
      ],
      signature: "Sanad Abujaber",
      footer: "Sanad Platform",
    };

    const ar = {
      subject: "أنت الآن ضمن قائمة الانتظار",
      greeting: name ? `مرحباً ${name}،` : "مرحباً،",
      body: [
        "يسعدني انضمامك إلى قائمة انتظار Sanad Platform.",
        "أعمل حالياً على بناء منصة تجمع الذكاء الاصطناعي، والأدوات العملية، والمحتوى في مكان واحد.",
        "بمجرد الإطلاق، ستكون من أوائل من يحصلون على الوصول.",
        "شكراً لثقتك، وأراك قريباً."
      ],
      signature: "سند أبو جابر",
      footer: "Sanad Platform",
    };

    const t = locale === "AR" ? ar : en;
    const dir = locale === "AR" ? "rtl" : "ltr";

    const html = `
<!DOCTYPE html>
<html lang="${locale === "AR" ? "ar" : "en"}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:40px 20px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">

        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
          style="background:#ffffff;border:1px solid #e5e7eb;border-top:4px solid #6d5dfc;border-radius:16px;padding:48px;">

          <tr>
            <td style="font-size:30px;font-weight:700;padding-bottom:24px;">
              ${t.greeting}
            </td>
          </tr>

          ${t.body
        .map(
          (p) => `
            <tr>
              <td style="font-size:16px;line-height:28px;color:#4b5563;padding-bottom:18px;">
                ${p}
              </td>
            </tr>`
        )
        .join("")}

          <tr>
            <td style="padding-top:20px;font-size:16px;font-weight:600;color:#6d5dfc;">
              ${t.signature}
              <br/>
              
            </td>
          </tr>

          <tr>
            <td style="padding-top:40px;border-top:1px solid #e5e7eb;font-size:13px;color:#9ca3af;">
              ${t.footer}
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;

    const text = `${t.greeting}\n\n${t.body.join('\n')}\n\n${t.signature}\n\n${t.footer}`;

    let attachments: any[] = [];
    try {
      const logoPath = '/Users/sanad/Work/SanadPortfolio/public/sanadlogo.png';
      if (fs.existsSync(logoPath)) {
        const logoContent = fs.readFileSync(logoPath).toString('base64');
        attachments = [{
          filename: 'sanadlogo.png',
          content: logoContent,
          contentId: 'sanadlogo'
        }];
      }
    } catch (err) {
      this.logger.error('Failed to load logo attachment: ' + err.message);
    }

    const resendKey = this.config.get<string>('resend.apiKey');
    try {
      if (resendKey) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.config.get<string>('resend.from'),
            to: [email],
            subject: t.subject,
            html,
            text,
            ...(attachments.length > 0 ? { attachments } : {})
          }),
        });
        if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
        return;
      }

      const host = this.config.get<string>('smtp.host');
      const user = this.config.get<string>('smtp.user');
      const pass = this.config.get<string>('smtp.pass');
      if (!host || !user || !pass) {
        this.logger.warn(
          `No mailer configured (RESEND_API_KEY or SMTP) — waitlist signup ${email} stored but not emailed.`,
        );
        return;
      }
      const transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('smtp.port'),
        secure: this.config.get<number>('smtp.port') === 465,
        auth: { user, pass },
      });
      await transporter.sendMail({
        from: this.config.get<string>('resend.from'),
        to: email,
        subject: t.subject,
        text,
        html,
        ...(attachments.length > 0 ? {
          attachments: attachments.map(att => ({
            filename: att.filename,
            content: Buffer.from(att.content, 'base64'),
            cid: 'sanadlogo'
          }))
        } : {})
      });
    } catch (error) {
      this.logger.error(`Failed to send waitlist email to ${email}: ${(error as Error).message}`);
    }
  }
}
