import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller.js';
import { FriendsService } from './friends.service.js';

@Module({
  controllers: [FriendsController],
  providers: [FriendsService],
  // Exported so UsersModule can show the viewer's relationship on profiles.
  exports: [FriendsService],
})
export class FriendsModule {}
