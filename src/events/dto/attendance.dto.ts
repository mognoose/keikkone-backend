import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AttendanceStatus } from '../../generated/prisma/enums.js';

export class SetAttendanceDto {
  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;
}
