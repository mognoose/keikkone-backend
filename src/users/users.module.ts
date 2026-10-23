import { Module } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [FriendsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
