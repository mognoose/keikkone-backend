import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.js';

export class CreateArtistDto {
  @ApiProperty({ example: 'Batham' })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string;

  @ApiPropertyOptional({ type: [String], example: ['metal'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];
}

export class ListArtistsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Name contains' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Genre slug' })
  @IsOptional()
  @IsString()
  genre?: string;
}
