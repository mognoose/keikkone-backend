import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUppercase,
  IsUrl,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AccessibilityFeature } from '../../generated/prisma/enums.js';

const webUrl = { protocols: ['https', 'http'], require_protocol: true };

export class EventArtistInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  artistId: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isHeadliner?: boolean;
}

export class CreateEventDto {
  @ApiProperty({ example: 'Batham + support' })
  @IsString()
  @Length(2, 150)
  title: string;

  @ApiPropertyOptional({
    description:
      '#hashtags written in the description are picked up automatically',
    example: 'Album release show! #metal #helsinki',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @ApiProperty({ example: '2026-12-12T19:00:00+02:00' })
  @IsDateString()
  startsAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  doorsAt?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  venueId: string;

  @ApiProperty({ type: [EventArtistInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  // @ValidateNested + @Type make the pipe validate each array element as a DTO.
  @ValidateNested({ each: true })
  @Type(() => EventArtistInputDto)
  artists: EventArtistInputDto[];

  @ApiPropertyOptional({
    type: [String],
    description: "Genre slugs. Defaults to the artists' genres when omitted.",
    example: ['metal'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @ApiPropertyOptional({ type: [String], example: ['albumrelease'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  hashtags?: string[];

  @ApiPropertyOptional({ example: 'https://www.tiketti.fi/...' })
  @IsOptional()
  @IsUrl(webUrl)
  ticketUrl?: string;

  @ApiPropertyOptional({
    description: 'Cheapest ticket in cents; 0 = free',
    example: 2500,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceMinCents?: number;

  @ApiPropertyOptional({
    description: 'Most expensive ticket in cents',
    example: 3500,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceMaxCents?: number;

  @ApiPropertyOptional({ default: 'EUR' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @IsUppercase()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Minimum age; omit for all ages (K-18 = 18)',
    example: 18,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  minAge?: number;

  @ApiPropertyOptional({ enum: AccessibilityFeature, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(AccessibilityFeature, { each: true })
  accessibility?: AccessibilityFeature[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  accessibilityNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(webUrl)
  coverImageUrl?: string;
}
