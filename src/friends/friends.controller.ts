import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { Auth, CurrentUser } from '../auth/decorators.js';
import {
  ListFriendRequestsQueryDto,
  SendFriendRequestDto,
} from './dto/friends.dto.js';
import { FriendsService } from './friends.service.js';

@ApiTags('friends')
@Auth()
@Controller()
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Post('friend-requests')
  send(@CurrentUser() me: AuthUser, @Body() dto: SendFriendRequestDto) {
    return this.friends.sendRequest(me.id, dto.userId);
  }

  @Get('friend-requests')
  list(
    @CurrentUser() me: AuthUser,
    @Query() query: ListFriendRequestsQueryDto,
  ) {
    return this.friends.listRequests(me.id, query.direction);
  }

  // ParseUUIDPipe turns a malformed id into a 400 before it reaches Postgres.
  @Post('friend-requests/:id/accept')
  @HttpCode(200)
  accept(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.accept(me.id, id);
  }

  @Post('friend-requests/:id/decline')
  @HttpCode(200)
  decline(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.decline(me.id, id);
  }

  @Delete('friend-requests/:id')
  @HttpCode(204)
  cancel(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.cancel(me.id, id);
  }

  @Get('me/friends')
  listFriends(@CurrentUser() me: AuthUser) {
    return this.friends.listFriends(me.id);
  }

  @Delete('me/friends/:userId')
  @HttpCode(204)
  unfriend(
    @CurrentUser() me: AuthUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.friends.unfriend(me.id, userId);
  }
}
