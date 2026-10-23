import type { Prisma } from '../generated/prisma/client.js';

/** The only user fields other users may ever see. */
export const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;
