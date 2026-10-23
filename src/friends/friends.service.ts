import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicUserSelect } from '../users/user-select.js';
import { RequestDirection } from './dto/friends.dto.js';

export type Relationship =
  'self' | 'friends' | 'request_sent' | 'request_received' | 'none';

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async sendRequest(meId: string, userId: string) {
    if (meId === userId) {
      throw new BadRequestException('You cannot befriend yourself');
    }
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');

    const relationship = await this.relationship(meId, userId);
    if (relationship === 'friends')
      throw new ConflictException('Already friends');
    if (relationship === 'request_sent')
      throw new ConflictException('Request already sent');

    // They already asked us: sending a request back simply accepts theirs.
    if (relationship === 'request_received') {
      const theirs = await this.prisma.friendRequest.findUniqueOrThrow({
        where: {
          requesterId_addresseeId: { requesterId: userId, addresseeId: meId },
        },
      });
      return this.accept(meId, theirs.id);
    }

    // Upsert so a previously declined request can be sent again.
    return this.prisma.friendRequest.upsert({
      where: {
        requesterId_addresseeId: { requesterId: meId, addresseeId: userId },
      },
      create: { requesterId: meId, addresseeId: userId },
      update: { status: 'PENDING' },
      include: { addressee: { select: publicUserSelect } },
    });
  }

  listRequests(meId: string, direction: RequestDirection) {
    const incoming = direction === RequestDirection.INCOMING;
    return this.prisma.friendRequest.findMany({
      where: {
        status: 'PENDING',
        ...(incoming ? { addresseeId: meId } : { requesterId: meId }),
      },
      include: incoming
        ? { requester: { select: publicUserSelect } }
        : { addressee: { select: publicUserSelect } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async accept(meId: string, requestId: string) {
    const request = await this.pendingRequest(requestId, { addresseeId: meId });
    // Both rows are written in one transaction so the friendship can never be
    // half-created (A sees B as friend but not vice versa).
    const [updated] = await this.prisma.$transaction([
      this.prisma.friendRequest.update({
        where: { id: request.id },
        data: { status: 'ACCEPTED' },
        include: { requester: { select: publicUserSelect } },
      }),
      this.prisma.friendship.createMany({
        data: [
          { userId: request.requesterId, friendId: request.addresseeId },
          { userId: request.addresseeId, friendId: request.requesterId },
        ],
        skipDuplicates: true,
      }),
    ]);
    return updated;
  }

  async decline(meId: string, requestId: string) {
    const request = await this.pendingRequest(requestId, { addresseeId: meId });
    return this.prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: 'DECLINED' },
    });
  }

  async cancel(meId: string, requestId: string) {
    const request = await this.pendingRequest(requestId, { requesterId: meId });
    await this.prisma.friendRequest.delete({ where: { id: request.id } });
  }

  async listFriends(meId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: { userId: meId },
      include: { friend: { select: publicUserSelect } },
      orderBy: { friend: { displayName: 'asc' } },
    });
    return rows.map((r) => ({ ...r.friend, friendsSince: r.createdAt }));
  }

  async unfriend(meId: string, friendId: string) {
    const pair = [
      { userId: meId, friendId },
      { userId: friendId, friendId: meId },
    ];
    const [deleted] = await this.prisma.$transaction([
      this.prisma.friendship.deleteMany({ where: { OR: pair } }),
      // Clear old requests so either side can send a fresh one later.
      this.prisma.friendRequest.deleteMany({
        where: {
          OR: [
            { requesterId: meId, addresseeId: friendId },
            { requesterId: friendId, addresseeId: meId },
          ],
        },
      }),
    ]);
    if (deleted.count === 0) throw new NotFoundException('Not friends');
  }

  async relationship(meId: string, otherId: string): Promise<Relationship> {
    if (meId === otherId) return 'self';
    const [friendship, requests] = await Promise.all([
      this.prisma.friendship.findUnique({
        where: { userId_friendId: { userId: meId, friendId: otherId } },
      }),
      this.prisma.friendRequest.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { requesterId: meId, addresseeId: otherId },
            { requesterId: otherId, addresseeId: meId },
          ],
        },
      }),
    ]);
    if (friendship) return 'friends';
    if (requests.some((r) => r.requesterId === meId)) return 'request_sent';
    if (requests.length > 0) return 'request_received';
    return 'none';
  }

  private async pendingRequest(
    id: string,
    owner: { addresseeId: string } | { requesterId: string },
  ) {
    const request = await this.prisma.friendRequest.findFirst({
      where: { id, status: 'PENDING', ...owner },
    });
    if (!request) throw new NotFoundException('Friend request not found');
    return request;
  }
}
