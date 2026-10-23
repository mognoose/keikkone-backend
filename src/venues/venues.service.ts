import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { cursorArgs, toPage } from '../common/pagination.js';
import { slugify } from '../common/slug.js';
import { VENUE_SIZE_RANGES, venueSizeOf } from '../common/venue-size.js';
import { SearchEventsQueryDto } from '../events/dto/search-events.dto.js';
import { EventsService } from '../events/events.service.js';
import type { Prisma, Venue } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateVenueDto, ListVenuesQueryDto } from './dto/venues.dto.js';

@Injectable()
export class VenuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async list(query: ListVenuesQueryDto) {
    const and: Prisma.VenueWhereInput[] = [];
    if (query.q) and.push({ name: { contains: query.q, mode: 'insensitive' } });
    if (query.city)
      and.push({ city: { equals: query.city, mode: 'insensitive' } });
    if (query.size?.length) {
      and.push({
        OR: query.size.map((s) => {
          const { min, max } = VENUE_SIZE_RANGES[s];
          return {
            capacity: { gte: min, ...(max !== undefined ? { lt: max } : {}) },
          };
        }),
      });
    }
    if (query.minCapacity !== undefined || query.maxCapacity !== undefined) {
      and.push({
        capacity: { gte: query.minCapacity, lte: query.maxCapacity },
      });
    }
    const rows = await this.prisma.venue.findMany({
      where: { AND: and },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...cursorArgs(query),
    });
    const page = toPage(rows, query.limit);
    return { ...page, items: page.items.map(present) };
  }

  async findBySlug(slug: string, viewerId: string | null) {
    const venue = await this.prisma.venue.findUnique({
      where: { slug: slugify(slug) },
    });
    if (!venue) throw new NotFoundException('Venue not found');
    const upcoming = await this.events.search(
      Object.assign(new SearchEventsQueryDto(), { venue: [venue.slug] }),
      viewerId,
    );
    return { ...present(venue), upcomingEvents: upcoming };
  }

  async create(dto: CreateVenueDto) {
    // City in the slug: "Nosturi" in Helsinki and in Tampere are different venues.
    const slug = slugify(`${dto.name} ${dto.city}`);
    if (!slug)
      throw new BadRequestException('Name must contain letters or digits');
    const existing = await this.prisma.venue.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException({
        message: 'Venue already exists',
        slug,
        id: existing.id,
      });
    }
    const venue = await this.prisma.venue.create({
      data: {
        name: dto.name.trim(),
        slug,
        address: dto.address.trim(),
        city: dto.city.trim(),
        country: dto.country?.toUpperCase(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        capacity: dto.capacity,
      },
    });
    return present(venue);
  }
}

function present(venue: Venue) {
  return { ...venue, size: venueSizeOf(venue.capacity) };
}
