import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthUser } from './auth-user.js';
import { JwtAuthGuard, OptionalJwtAuthGuard } from './guards.js';

/** Route requires a logged-in user. */
export const Auth = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token' }),
  );

/** Route works anonymously but returns extra data for logged-in users. */
export const OptionalAuth = () =>
  applyDecorators(UseGuards(OptionalJwtAuthGuard), ApiBearerAuth());

/** Injects `request.user` (null on anonymous OptionalAuth routes). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | null =>
    ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>().user ?? null,
);
