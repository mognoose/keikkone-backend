import { ApiPropertyOptional, type ApiPropertyOptions } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.js';
import { ToArray, ToBoolean } from '../../common/transforms.js';
import { VenueSize } from '../../common/venue-size.js';
import { AccessibilityFeature } from '../../generated/prisma/enums.js';

export enum EventSort {
  DATE = 'date',
  PRICE = 'price',
}

const listDoc = (description: string): ApiPropertyOptions => ({
  type: [String],
  description: `${description} (repeat the param or comma-separate)`,
});

export class SearchEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Free text: event title, artist, venue or hashtag',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional(listDoc('Artist slugs'))
  @IsOptional()
  @ToArray()
  @IsString({ each: true })
  artist?: string[];

  @ApiPropertyOptional(listDoc('Venue slugs'))
  @IsOptional()
  @ToArray()
  @IsString({ each: true })
  venue?: string[];

  @ApiPropertyOptional({ example: 'Helsinki' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional(listDoc('Genre slugs, matches any'))
  @IsOptional()
  @ToArray()
  @IsString({ each: true })
  genre?: string[];

  @ApiPropertyOptional(listDoc('Hashtags with or without #, matches any'))
  @IsOptional()
  @ToArray()
  @IsString({ each: true })
  hashtag?: string[];

  @ApiPropertyOptional({ enum: VenueSize, isArray: true })
  @IsOptional()
  @ToArray()
  @IsEnum(VenueSize, { each: true })
  venueSize?: VenueSize[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxCapacity?: number;

  @ApiPropertyOptional({
    description: 'Cheapest ticket must cost at least this (cents)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMinCents?: number;

  @ApiPropertyOptional({
    description: 'Cheapest ticket must cost at most this (cents)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMaxCents?: number;

  @ApiPropertyOptional({ description: 'Only free events' })
  @IsOptional()
  @ToBoolean()
  free?: boolean;

  @ApiPropertyOptional({ description: 'Start of date range (default: now)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End of date range' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Only events a person of this age may attend',
    example: 16,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  age?: number;

  @ApiPropertyOptional({ description: 'Only events without an age limit' })
  @IsOptional()
  @ToBoolean()
  allAges?: boolean;

  @ApiPropertyOptional({
    enum: AccessibilityFeature,
    isArray: true,
    description: 'Must have all listed',
  })
  @IsOptional()
  @ToArray()
  @IsEnum(AccessibilityFeature, { each: true })
  accessibility?: AccessibilityFeature[];

  @ApiPropertyOptional({
    description:
      'Only events friends are going to / interested in (requires login)',
  })
  @IsOptional()
  @ToBoolean()
  friendsAttending?: boolean;

  @ApiPropertyOptional({ description: 'Include cancelled events' })
  @IsOptional()
  @ToBoolean()
  includeCancelled?: boolean;

  @ApiPropertyOptional({ enum: EventSort, default: EventSort.DATE })
  @IsOptional()
  @IsEnum(EventSort)
  sort: EventSort = EventSort.DATE;
}
