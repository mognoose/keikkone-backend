import { plainToInstance } from 'class-transformer';
import { VenueSize } from '../common/venue-size.js';
import { SearchEventsQueryDto } from './dto/search-events.dto.js';
import { buildEventWhere } from './event-where.js';

const now = new Date('2026-10-23T12:00:00Z');
const query = (q: Record<string, unknown>) =>
  plainToInstance(SearchEventsQueryDto, q);
const and = (q: Record<string, unknown>, viewer: string | null = null) =>
  buildEventWhere(query(q), viewer, now).AND as Record<string, unknown>[];

describe('buildEventWhere', () => {
  it('defaults to upcoming, non-cancelled events', () => {
    expect(and({})).toEqual([
      { startsAt: { gte: now } },
      { status: { not: 'CANCELLED' } },
    ]);
  });

  it('applies the date range', () => {
    expect(
      and({ from: '2026-11-01T00:00:00Z', to: '2026-11-30T00:00:00Z' })[0],
    ).toEqual({
      startsAt: {
        gte: new Date('2026-11-01T00:00:00Z'),
        lte: new Date('2026-11-30T00:00:00Z'),
      },
    });
  });

  it('accepts comma-separated and repeated list params', () => {
    // Exercises the @ToArray transform the same way ValidationPipe does.
    expect(query({ genre: 'metal,Jazz' }).genre).toEqual(['metal', 'Jazz']);
    expect(query({ genre: ['metal', 'rock'] }).genre).toEqual([
      'metal',
      'rock',
    ]);
    expect(and({ genre: 'metal,Jazz' })).toContainEqual({
      genres: { some: { genre: { slug: { in: ['metal', 'jazz'] } } } },
    });
  });

  it('normalizes hashtags', () => {
    expect(and({ hashtag: '#Metal' })).toContainEqual({
      hashtags: { some: { hashtag: { tag: { in: ['metal'] } } } },
    });
  });

  it('maps venue size buckets to capacity ranges', () => {
    expect(
      and({ venueSize: [VenueSize.SMALL, VenueSize.ARENA] }),
    ).toContainEqual({
      OR: [
        { venue: { capacity: { gte: 0, lt: 300 } } },
        { venue: { capacity: { gte: 5000 } } },
      ],
    });
  });

  it('filters price on the cheapest ticket', () => {
    expect(and({ priceMaxCents: '2000' })).toContainEqual({
      priceMinCents: { gte: undefined, lte: 2000 },
    });
    expect(and({ free: 'true' })).toContainEqual({ priceMinCents: 0 });
    expect(and({ free: 'false' })).not.toContainEqual({ priceMinCents: 0 });
  });

  it('age filter keeps all-ages events and those within the limit', () => {
    expect(and({ age: '16' })).toContainEqual({
      OR: [{ minAge: null }, { minAge: { lte: 16 } }],
    });
  });

  it('only adds the friends filter for a logged-in viewer', () => {
    const friendsFilter = {
      attendances: { some: { user: { friendOf: { some: { userId: 'me' } } } } },
    };
    expect(and({ friendsAttending: 'true' }, 'me')).toContainEqual(
      friendsFilter,
    );
    expect(and({ friendsAttending: 'true' }, null)).not.toContainEqual(
      friendsFilter,
    );
  });
});
