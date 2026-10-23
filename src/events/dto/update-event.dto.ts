import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { EventStatus } from '../../generated/prisma/enums.js';
import { CreateEventDto } from './create-event.dto.js';

// PartialType (from @nestjs/swagger, not @nestjs/mapped-types) copies every
// field and its validators as optional AND keeps the OpenAPI metadata.
export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
