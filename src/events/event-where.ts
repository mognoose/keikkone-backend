import { normalizeTag } from '../common/hashtags.js';
import { slugify } from '../common/slug.js';
import { VENUE_SIZE_RANGES } from '../common/venue-size.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { SearchEventsQueryDto } from './dto/search-events.dto.js';

/**
 * Events whose attendees include at least one friend of `viewerId`.
 * Friendship rows are directed (viewer -> friend), so "attendee X is my
 * friend" means X has a `friendOf` row whose userId is the viewer.
 */
export function attendedByFriendsOf(viewerId: string): Prisma.EventWhereInput {
  return {
    attendances: {
      some: { user: { friendOf: { some: { userId: viewerId } } } },
    },
  };
}

/**
 * Turns search query params into a Prisma where clause. Every filter is an
 * entry in AND, so filters combine (genre=metal AND venueSize=SMALL), while
 * multi-value params inside one filter match any (genre=metal,rock).
 */
export function buildEventWhere(
  query: SearchEventsQueryDto,
  viewerId: string | null,
  now = new Date(),
): Prisma.EventWhereInput {
  const and: Prisma.EventWhereInput[] = [];

  and.push({
    startsAt: {
      gte: query.from ? new Date(query.from) : now,
      ...(query.to ? { lte: new Date(query.to) } : {}),
    },
  });

  if (!query.includeCancelled) and.push({ status: { not: 'CANCELLED' } });

  if (query.q?.trim()) {
    const q = query.q.trim();
    const tag = normalizeTag(q);
    and.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        {
          artists: {
            some: { artist: { name: { contains: q, mode: 'insensitive' } } },
          },
        },
        { venue: { name: { contains: q, mode: 'insensitive' } } },
        ...(tag ? [{ hashtags: { some: { hashtag: { tag } } } }] : []),
      ],
    });
  }

  if (query.artist?.length) {
    and.push({
      artists: {
        some: { artist: { slug: { in: query.artist.map(slugify) } } },
      },
    });
  }

  if (query.venue?.length) {
    and.push({ venue: { slug: { in: query.venue.map(slugify) } } });
  }

  if (query.city) {
    and.push({
      venue: { city: { equals: query.city.trim(), mode: 'insensitive' } },
    });
  }

  if (query.genre?.length) {
    and.push({
      genres: { some: { genre: { slug: { in: query.genre.map(slugify) } } } },
    });
  }

  if (query.hashtag?.length) {
    const tags = query.hashtag
      .map(normalizeTag)
      .filter((t): t is string => !!t);
    and.push({ hashtags: { some: { hashtag: { tag: { in: tags } } } } });
  }

  if (query.venueSize?.length) {
    and.push({
      OR: query.venueSize.map((size) => {
        const { min, max } = VENUE_SIZE_RANGES[size];
        return {
          venue: {
            capacity: { gte: min, ...(max !== undefined ? { lt: max } : {}) },
          },
        };
      }),
    });
  }

  if (query.minCapacity !== undefined || query.maxCapacity !== undefined) {
    and.push({
      venue: { capacity: { gte: query.minCapacity, lte: query.maxCapacity } },
    });
  }

  // Price filters look at the cheapest ticket. Events with an unknown price
  // drop out of price-filtered results, since we can't say they match.
  if (query.free) {
    and.push({ priceMinCents: 0 });
  }
  if (query.priceMinCents !== undefined || query.priceMaxCents !== undefined) {
    and.push({
      priceMinCents: { gte: query.priceMinCents, lte: query.priceMaxCents },
    });
  }

  if (query.allAges) {
    and.push({ minAge: null });
  }
  if (query.age !== undefined) {
    and.push({ OR: [{ minAge: null }, { minAge: { lte: query.age } }] });
  }

  if (query.accessibility?.length) {
    and.push({ accessibility: { hasEvery: query.accessibility } });
  }

  if (query.friendsAttending && viewerId) {
    and.push(attendedByFriendsOf(viewerId));
  }

  return { AND: and };
}
