import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinWaitlistDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: ['EN', 'AR'], default: 'EN' })
  @IsOptional()
  @IsIn(['EN', 'AR'])
  locale?: 'EN' | 'AR';

  // Honeypot — hidden on the page; humans leave it empty, bots fill it.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
