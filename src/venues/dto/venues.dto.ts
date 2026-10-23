import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.js';
import { ToArray } from '../../common/transforms.js';
import { VenueSize } from '../../common/venue-size.js';

export class CreateVenueDto {
  @ApiProperty({ example: 'Tavastia' })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiProperty({ example: 'Urho Kekkosen katu 4-6' })
  @IsString()
  @Length(1, 200)
  address: string;

  @ApiProperty({ example: 'Helsinki' })
  @IsString()
  @Length(1, 100)
  city: string;

  @ApiPropertyOptional({ default: 'FI', description: 'ISO 3166-1 alpha-2' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiProperty({ example: 900 })
  @IsInt()
  @Min(1)
  @Max(200_000)
  capacity: number;
}

export class ListVenuesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Name contains' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ enum: VenueSize, isArray: true })
  @IsOptional()
  @ToArray()
  @IsEnum(VenueSize, { each: true })
  size?: VenueSize[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxCapacity?: number;
}
