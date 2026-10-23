import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimLower = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

export class RegisterDto {
  @ApiProperty({ example: 'sapatti@example.com' })
  @trimLower()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'sapatti',
    description: '3-30 chars: a-z, 0-9, _ and .',
  })
  @trimLower()
  @Matches(/^[a-z0-9_.]{3,30}$/, {
    message: 'username must be 3-30 characters of a-z, 0-9, _ or .',
  })
  username: string;

  @ApiProperty({ example: 'Sapatti' })
  @IsString()
  @Length(1, 60)
  displayName: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'sapatti@example.com' })
  @trimLower()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}
