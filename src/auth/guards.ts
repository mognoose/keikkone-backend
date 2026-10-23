import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

/** Rejects the request with 401 unless a valid access token is present. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

/**
 * Lets anonymous requests through with `request.user = null`, but still
 * rejects a token that is present and invalid/expired, so clients know to
 * refresh instead of silently getting the logged-out view.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(
    err: unknown,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser | null {
    if (user) return user;
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers.authorization) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    return null;
  }
}
