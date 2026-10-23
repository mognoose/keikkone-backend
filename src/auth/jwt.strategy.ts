import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../config/env.js';
import type { AuthUser, JwtPayload } from './auth-user.js';

/**
 * A Passport strategy is a provider: Nest instantiates it via DI and registers
 * it under the name 'jwt', which AuthGuard('jwt') then refers to.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  // The access token is self-contained, so no DB hit per request. The trade-off:
  // a deleted user keeps access until the token expires (15 min by default).
  validate(payload: JwtPayload): AuthUser {
    return { id: payload.sub, username: payload.username, role: payload.role };
  }
}
