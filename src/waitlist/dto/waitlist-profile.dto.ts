import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class WaitlistProfileDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  role?: string;

  @ApiPropertyOptional({ type: [String], example: ['AI Assistant', 'CV & Resume Tools'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  interests?: string[];

  @ApiPropertyOptional({ example: 'Land a job' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  primaryGoal?: string;

  @ApiPropertyOptional({ example: 'Jordan' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  @ApiPropertyOptional({ example: 'Finding a job' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  challenge?: string;

  @ApiPropertyOptional({ enum: ['EN', 'AR'], default: 'EN' })
  @IsOptional()
  @IsIn(['EN', 'AR'])
  locale?: 'EN' | 'AR';
}
