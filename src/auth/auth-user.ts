import type { Role } from '../generated/prisma/client.js';

/** What JwtStrategy.validate() puts on `request.user`. */
export interface AuthUser {
  id: string;
  username: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
}
