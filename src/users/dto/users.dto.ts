import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.js';

export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 60)
  displayName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  avatarUrl?: string | null;
}

export class SearchUsersQueryDto extends PaginationQueryDto {
  @ApiProperty({ description: 'Matches username or display name' })
  @IsString()
  @MinLength(2)
  q: string;
}
