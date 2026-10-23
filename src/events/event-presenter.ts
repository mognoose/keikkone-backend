import { venueSizeOf } from '../common/venue-size.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AttendanceStatus } from '../generated/prisma/enums.js';
import { publicUserSelect, type PublicUser } from '../users/user-select.js';

/** Relations loaded for every event in list and detail responses. */
export const eventInclude = {
  venue: {
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      city: true,
      country: true,
      capacity: true,
      latitude: true,
      longitude: true,
    },
  },
  artists: {
    include: {
      artist: { select: { id: true, name: true, slug: true, imageUrl: true } },
    },
    orderBy: [{ isHeadliner: 'desc' }, { sortOrder: 'asc' }],
  },
  genres: { include: { genre: { select: { name: true, slug: true } } } },
  hashtags: { include: { hashtag: { select: { tag: true } } } },
  createdBy: { select: publicUserSelect },
} satisfies Prisma.EventInclude;

export type EventWithRelations = Prisma.EventGetPayload<{
  include: typeof eventInclude;
}>;

export interface AttendanceCounts {
  going: number;
  interested: number;
  /** Only present for logged-in viewers. */
  friends?: number;
}

export interface ViewerContext {
  myAttendance: AttendanceStatus | null;
  friendsAttending: { user: PublicUser; status: AttendanceStatus }[];
}

export function presentEvent(
  event: EventWithRelations,
  counts: AttendanceCounts,
  viewer?: ViewerContext,
) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    status: event.status,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    doorsAt: event.doorsAt,
    venue: { ...event.venue, size: venueSizeOf(event.venue.capacity) },
    artists: event.artists.map((a) => ({
      ...a.artist,
      isHeadliner: a.isHeadliner,
    })),
    genres: event.genres.map((g) => g.genre),
    hashtags: event.hashtags.map((h) => h.hashtag.tag).sort(),
    ticketUrl: event.ticketUrl,
    price: {
      minCents: event.priceMinCents,
      maxCents: event.priceMaxCents,
      currency: event.currency,
      isFree: event.priceMinCents === 0 && (event.priceMaxCents ?? 0) === 0,
    },
    minAge: event.minAge,
    accessibility: event.accessibility,
    accessibilityNotes: event.accessibilityNotes,
    coverImageUrl: event.coverImageUrl,
    createdBy: event.createdBy,
    createdAt: event.createdAt,
    attendance: counts,
    ...viewer,
  };
}

export type PresentedEvent = ReturnType<typeof presentEvent>;
