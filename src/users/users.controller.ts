import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { Auth, CurrentUser } from '../auth/decorators.js';
import { SearchUsersQueryDto, UpdateMeDto } from './dto/users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Auth()
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() me: AuthUser) {
    return this.users.getMe(me.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() me: AuthUser, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(me.id, dto);
  }

  @Get('users')
  search(@Query() query: SearchUsersQueryDto) {
    return this.users.search(query);
  }

  @Get('users/:username')
  profile(@CurrentUser() me: AuthUser, @Param('username') username: string) {
    return this.users.profile(me.id, username);
  }
}
