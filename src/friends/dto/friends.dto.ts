import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class SendFriendRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId: string;
}

export enum RequestDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
}

export class ListFriendRequestsQueryDto {
  @ApiPropertyOptional({
    enum: RequestDirection,
    default: RequestDirection.INCOMING,
  })
  @IsOptional()
  @IsEnum(RequestDirection)
  direction: RequestDirection = RequestDirection.INCOMING;
}
