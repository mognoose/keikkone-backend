import { Injectable, NotFoundException } from '@nestjs/common';
import { cursorArgs, toPage } from '../common/pagination.js';
import { FriendsService } from '../friends/friends.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SearchUsersQueryDto, UpdateMeDto } from './dto/users.dto.js';
import { publicUserSelect } from './user-select.js';

const meSelect = {
  ...publicUserSelect,
  email: true,
  role: true,
  createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
  ) {}

  getMe(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: meSelect,
    });
  }

  updateMe(id: string, dto: UpdateMeDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: meSelect,
    });
  }

  async search(query: SearchUsersQueryDto) {
    const rows = await this.prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query.q, mode: 'insensitive' } },
          { displayName: { contains: query.q, mode: 'insensitive' } },
        ],
      },
      select: publicUserSelect,
      orderBy: [{ username: 'asc' }, { id: 'asc' }],
      ...cursorArgs(query),
    });
    return toPage(rows, query.limit);
  }

  async profile(viewerId: string, username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: {
        ...publicUserSelect,
        _count: { select: { friendships: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { _count, ...rest } = user;
    return {
      ...rest,
      friendCount: _count.friendships,
      relationship: await this.friends.relationship(viewerId, user.id),
    };
  }
}
