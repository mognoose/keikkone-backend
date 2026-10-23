import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { collectHashtags } from '../common/hashtags.js';
import { cursorArgs, toPage, type Page } from '../common/pagination.js';
import { slugify } from '../common/slug.js';
import type { AuthUser } from '../auth/auth-user.js';
import { Prisma } from '../generated/prisma/client.js';
import type { AttendanceStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicUserSelect } from '../users/user-select.js';
import type { CreateEventDto } from './dto/create-event.dto.js';
import {
  EventSort,
  type SearchEventsQueryDto,
} from './dto/search-events.dto.js';
import type { UpdateEventDto } from './dto/update-event.dto.js';
import {
  eventInclude,
  presentEvent,
  type AttendanceCounts,
  type EventWithRelations,
  type PresentedEvent,
} from './event-presenter.js';
import { buildEventWhere } from './event-where.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Queries ───────────────────────────────────────────────────────────────

  async search(
    query: SearchEventsQueryDto,
    viewerId: string | null,
  ): Promise<Page<PresentedEvent>> {
    const where = buildEventWhere(query, viewerId);
    const orderBy: Prisma.EventOrderByWithRelationInput[] =
      query.sort === EventSort.PRICE
        ? [{ priceMinCents: 'asc' }, { startsAt: 'asc' }, { id: 'asc' }]
        : [{ startsAt: 'asc' }, { id: 'asc' }];
    if (query.sort === EventSort.PRICE) {
      // Price-sorted lists only contain events with a known price.
      (where.AND as Prisma.EventWhereInput[]).push({
        priceMinCents: { not: null },
      });
    }

    const rows = await this.prisma.event.findMany({
      where,
      include: eventInclude,
      orderBy,
      ...cursorArgs(query),
    });
    const page = toPage(rows, query.limit);
    return { ...page, items: await this.present(page.items, viewerId) };
  }

  async findOne(id: string, viewerId: string | null) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: eventInclude,
    });
    if (!event) throw new NotFoundException('Event not found');
    const counts = (await this.counts([event.id], viewerId)).get(event.id)!;
    if (!viewerId) return presentEvent(event, counts);

    const [mine, friends] = await Promise.all([
      this.prisma.attendance.findUnique({
        where: { userId_eventId: { userId: viewerId, eventId: id } },
      }),
      // Attendee identities are only ever revealed to their friends.
      this.prisma.attendance.findMany({
        where: {
          eventId: id,
          user: { friendOf: { some: { userId: viewerId } } },
        },
        include: { user: { select: publicUserSelect } },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    return presentEvent(event, counts, {
      myAttendance: mine?.status ?? null,
      friendsAttending: friends.map((a) => ({
        user: a.user,
        status: a.status,
      })),
    });
  }

  /**
   * Upcoming events friends are attending, ranked by how many friends go.
   * Ranking by a filtered relation count is beyond Prisma's query builder, so
   * this one uses SQL; $queryRaw's tagged template parameterises the values.
   */
  async feed(viewerId: string, limit: number, offset: number) {
    const ranked = await this.prisma.$queryRaw<
      { eventId: string; friends: bigint }[]
    >`
      SELECT a."eventId", COUNT(*) AS friends
      FROM "Attendance" a
      JOIN "Friendship" f ON f."friendId" = a."userId" AND f."userId" = ${viewerId}::uuid
      JOIN "Event" e ON e.id = a."eventId"
      WHERE e."startsAt" >= now() AND e.status <> 'CANCELLED'
      GROUP BY a."eventId", e."startsAt"
      ORDER BY friends DESC, e."startsAt" ASC
      LIMIT ${limit + 1} OFFSET ${offset}`;

    const hasMore = ranked.length > limit;
    const ids = ranked.slice(0, limit).map((r) => r.eventId);
    const events = await this.prisma.event.findMany({
      where: { id: { in: ids } },
      include: eventInclude,
    });
    const byId = new Map(events.map((e) => [e.id, e]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((e) => e !== undefined);
    return {
      items: await this.present(ordered, viewerId),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  async create(user: AuthUser, dto: CreateEventDto) {
    this.assertConsistent(dto);
    const id = await this.prisma.$transaction(async (tx) => {
      await this.assertVenueExists(tx, dto.venueId);
      const artistIds = await this.resolveArtists(
        tx,
        dto.artists.map((a) => a.artistId),
      );
      const genreIds = dto.genres
        ? await this.resolveGenres(tx, dto.genres)
        : await this.genresOfArtists(tx, artistIds);
      const hashtagIds = await this.upsertHashtags(
        tx,
        collectHashtags(dto.hashtags, dto.description),
      );

      const event = await tx.event.create({
        data: {
          ...this.scalarFields(dto),
          title: dto.title,
          startsAt: new Date(dto.startsAt),
          venue: { connect: { id: dto.venueId } },
          createdBy: { connect: { id: user.id } },
          artists: { create: this.artistRows(dto.artists) },
          genres: { create: genreIds.map((genreId) => ({ genreId })) },
          hashtags: { create: hashtagIds.map((hashtagId) => ({ hashtagId })) },
        },
      });
      return event.id;
    });
    return this.findOne(id, user.id);
  }

  async update(user: AuthUser, id: string, dto: UpdateEventDto) {
    const existing = await this.prisma.event.findUnique({
      where: { id },
      include: { hashtags: { include: { hashtag: true } } },
    });
    if (!existing) throw new NotFoundException('Event not found');
    this.assertCanEdit(user, existing.createdById);
    this.assertConsistent({
      startsAt: dto.startsAt ?? existing.startsAt.toISOString(),
      endsAt: dto.endsAt ?? existing.endsAt?.toISOString(),
      priceMinCents: dto.priceMinCents ?? existing.priceMinCents ?? undefined,
      priceMaxCents: dto.priceMaxCents ?? existing.priceMaxCents ?? undefined,
    });

    await this.prisma.$transaction(async (tx) => {
      if (dto.venueId) await this.assertVenueExists(tx, dto.venueId);

      // Relations given in the update replace the old ones entirely.
      if (dto.artists) {
        await this.resolveArtists(
          tx,
          dto.artists.map((a) => a.artistId),
        );
        await tx.eventArtist.deleteMany({ where: { eventId: id } });
        await tx.eventArtist.createMany({
          data: this.artistRows(dto.artists).map((row) => ({
            ...row,
            eventId: id,
          })),
        });
      }
      if (dto.genres) {
        const genreIds = await this.resolveGenres(tx, dto.genres);
        await tx.eventGenre.deleteMany({ where: { eventId: id } });
        await tx.eventGenre.createMany({
          data: genreIds.map((genreId) => ({ eventId: id, genreId })),
        });
      }
      if (dto.hashtags !== undefined || dto.description !== undefined) {
        const tags = this.updatedTags(
          existing.hashtags.map((h) => h.hashtag.tag),
          existing.description,
          dto,
        );
        const hashtagIds = await this.upsertHashtags(tx, tags);
        await tx.eventHashtag.deleteMany({ where: { eventId: id } });
        await tx.eventHashtag.createMany({
          data: hashtagIds.map((hashtagId) => ({ eventId: id, hashtagId })),
        });
      }

      await tx.event.update({
        where: { id },
        data: {
          ...this.scalarFields(dto),
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
          ...(dto.venueId ? { venueId: dto.venueId } : {}),
          ...(dto.status ? { status: dto.status } : {}),
        },
      });
    });
    return this.findOne(id, user.id);
  }

  /** Soft delete: attendees should see "cancelled", not a 404. */
  async cancel(user: AuthUser, id: string) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Event not found');
    this.assertCanEdit(user, existing.createdById);
    await this.prisma.event.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async setAttendance(
    userId: string,
    eventId: string,
    status: AttendanceStatus,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status === 'CANCELLED') {
      throw new BadRequestException('Event is cancelled');
    }
    await this.prisma.attendance.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId, status },
      update: { status },
    });
    return this.findOne(eventId, userId);
  }

  async removeAttendance(userId: string, eventId: string) {
    await this.prisma.attendance.deleteMany({ where: { userId, eventId } });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async present(events: EventWithRelations[], viewerId: string | null) {
    const counts = await this.counts(
      events.map((e) => e.id),
      viewerId,
    );
    return events.map((e) => presentEvent(e, counts.get(e.id)!));
  }

  /** Going/interested counts (and friend counts for viewers) in two grouped queries. */
  private async counts(eventIds: string[], viewerId: string | null) {
    const result = new Map<string, AttendanceCounts>(
      eventIds.map((id) => [
        id,
        { going: 0, interested: 0, ...(viewerId ? { friends: 0 } : {}) },
      ]),
    );
    if (eventIds.length === 0) return result;

    const [byStatus, byFriends] = await Promise.all([
      this.prisma.attendance.groupBy({
        by: ['eventId', 'status'],
        where: { eventId: { in: eventIds } },
        _count: { _all: true },
      }),
      viewerId
        ? this.prisma.attendance.groupBy({
            by: ['eventId'],
            where: {
              eventId: { in: eventIds },
              user: { friendOf: { some: { userId: viewerId } } },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);
    for (const row of byStatus) {
      const c = result.get(row.eventId)!;
      if (row.status === 'GOING') c.going = row._count._all;
      else c.interested = row._count._all;
    }
    for (const row of byFriends)
      result.get(row.eventId)!.friends = row._count._all;
    return result;
  }

  /**
   * Description edits keep manually added tags but swap the tags that came
   * from the old description for those in the new one.
   */
  private updatedTags(
    current: string[],
    oldDescription: string,
    dto: UpdateEventDto,
  ) {
    if (dto.hashtags !== undefined) {
      return collectHashtags(dto.hashtags, dto.description ?? oldDescription);
    }
    const fromOld = new Set(collectHashtags([], oldDescription));
    const manual = current.filter((t) => !fromOld.has(t));
    return collectHashtags(manual, dto.description);
  }

  private scalarFields(dto: UpdateEventDto) {
    const date = (v: string | undefined) =>
      v === undefined ? undefined : new Date(v);
    return {
      description: dto.description,
      endsAt: date(dto.endsAt),
      doorsAt: date(dto.doorsAt),
      ticketUrl: dto.ticketUrl,
      priceMinCents: dto.priceMinCents,
      priceMaxCents: dto.priceMaxCents,
      currency: dto.currency,
      minAge: dto.minAge,
      accessibility: dto.accessibility,
      accessibilityNotes: dto.accessibilityNotes,
      coverImageUrl: dto.coverImageUrl,
    };
  }

  private artistRows(artists: CreateEventDto['artists']) {
    return artists.map((a, index) => ({
      artistId: a.artistId,
      isHeadliner: a.isHeadliner ?? index === 0,
      sortOrder: index,
    }));
  }

  private assertConsistent(dto: {
    startsAt?: string;
    endsAt?: string;
    priceMinCents?: number;
    priceMaxCents?: number;
  }) {
    if (
      dto.startsAt &&
      dto.endsAt &&
      new Date(dto.endsAt) <= new Date(dto.startsAt)
    ) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    if (
      dto.priceMinCents !== undefined &&
      dto.priceMaxCents !== undefined &&
      dto.priceMaxCents < dto.priceMinCents
    ) {
      throw new BadRequestException('priceMaxCents must be >= priceMinCents');
    }
  }

  private assertCanEdit(user: AuthUser, createdById: string) {
    if (user.role !== 'ADMIN' && user.id !== createdById) {
      throw new ForbiddenException(
        'Only the creator or an admin can modify this event',
      );
    }
  }

  private async assertVenueExists(tx: Tx, venueId: string) {
    if (!(await tx.venue.findUnique({ where: { id: venueId } }))) {
      throw new BadRequestException('Venue not found');
    }
  }

  private async resolveArtists(tx: Tx, ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length)
      throw new BadRequestException('Duplicate artists');
    const found = await tx.artist.count({ where: { id: { in: unique } } });
    if (found !== unique.length)
      throw new BadRequestException('Unknown artist');
    return unique;
  }

  private async resolveGenres(tx: Tx, slugs: string[]) {
    const wanted = [...new Set(slugs.map(slugify))];
    const genres = await tx.genre.findMany({ where: { slug: { in: wanted } } });
    if (genres.length !== wanted.length) {
      const known = new Set(genres.map((g) => g.slug));
      throw new BadRequestException(
        `Unknown genre: ${wanted.filter((s) => !known.has(s)).join(', ')}`,
      );
    }
    return genres.map((g) => g.id);
  }

  private async genresOfArtists(tx: Tx, artistIds: string[]) {
    const rows = await tx.artistGenre.findMany({
      where: { artistId: { in: artistIds } },
      distinct: ['genreId'],
    });
    return rows.map((r) => r.genreId);
  }

  private async upsertHashtags(tx: Tx, tags: string[]) {
    if (tags.length === 0) return [];
    await tx.hashtag.createMany({
      data: tags.map((tag) => ({ tag })),
      skipDuplicates: true,
    });
    const rows = await tx.hashtag.findMany({ where: { tag: { in: tags } } });
    return rows.map((r) => r.id);
  }
}
