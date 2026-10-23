import { Injectable } from '@nestjs/common';
import { normalizeTag } from '../common/hashtags.js';
import { PrismaService } from '../prisma/prisma.service.js';

const upcoming = () => ({
  startsAt: { gte: new Date() },
  status: { not: 'CANCELLED' as const },
});

@Injectable()
export class HashtagsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Prefix autocomplete, most used first: "me" -> metal, metalcore, ... */
  async autocomplete(q: string, limit: number) {
    const prefix = normalizeTag(q);
    if (!prefix) return [];
    const rows = await this.prisma.hashtag.findMany({
      where: { tag: { startsWith: prefix } },
      select: { tag: true, _count: { select: { events: true } } },
      orderBy: { events: { _count: 'desc' } },
      take: limit,
    });
    return rows.map((r) => ({ tag: r.tag, eventCount: r._count.events }));
  }

  /** Tags on the most upcoming events. */
  async trending(limit: number) {
    const rows = await this.prisma.eventHashtag.groupBy({
      by: ['hashtagId'],
      where: { event: upcoming() },
      _count: { _all: true },
      orderBy: { _count: { hashtagId: 'desc' } },
      take: limit,
    });
    const tags = await this.prisma.hashtag.findMany({
      where: { id: { in: rows.map((r) => r.hashtagId) } },
    });
    const byId = new Map(tags.map((t) => [t.id, t.tag]));
    return rows.map((r) => ({
      tag: byId.get(r.hashtagId)!,
      upcomingEventCount: r._count._all,
    }));
  }
}
