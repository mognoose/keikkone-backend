import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ArtistsModule } from './artists/artists.module.js';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv } from './config/env.js';
import { EventsModule } from './events/events.module.js';
import { FriendsModule } from './friends/friends.module.js';
import { GenresModule } from './genres/genres.module.js';
import { HashtagsModule } from './hashtags/hashtags.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { VenuesModule } from './venues/venues.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      validate: validateEnv,
    }),
    // Default: 120 requests/minute per IP. Auth routes override this.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    FriendsModule,
    GenresModule,
    ArtistsModule,
    VenuesModule,
    HashtagsModule,
    EventsModule,
  ],
  controllers: [HealthController],
  // APP_GUARD registers ThrottlerGuard for every route, with DI support.
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
