/**
 * Idempotent demo data: venues, artists, three demo users (alice, bob, carol)
 * and upcoming events. Safe to re-run; demo events are recreated each time.
 * Genres are not seeded here: they ship as a migration (reference data).
 *
 * Password: "password123" on a local database. Any other database requires
 * SEED_PASSWORD, so a known password never ends up on a public server:
 *   SEED_PASSWORD='...' DATABASE_URL='<neon direct url>' npx tsx prisma/seed.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { collectHashtags } from '../src/common/hashtags.js';
import { slugify } from '../src/common/slug.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

// Decided by where the database is, not by NODE_ENV: running this from a
// laptop against Neon has no NODE_ENV=production to trip over.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', 'host.docker.internal'];
const dbHost = new URL(DATABASE_URL).hostname;
const isLocalDb = LOCAL_HOSTS.includes(dbHost);

function resolvePassword(): string {
  const password =
    process.env.SEED_PASSWORD ?? (isLocalDb ? 'password123' : undefined);
  if (!password) {
    throw new Error(
      `Refusing to seed ${dbHost} with the default demo password. Set SEED_PASSWORD.`,
    );
  }
  if (!isLocalDb && password.length < 12) {
    throw new Error(
      'SEED_PASSWORD must be at least 12 characters for a non-local database',
    );
  }
  return password;
}
const password = resolvePassword();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

const VENUES = [
  {
    name: 'Bar Loose',
    address: 'Annankatu 21',
    city: 'Helsinki',
    capacity: 250,
  },
  {
    name: 'Tavastia',
    address: 'Urho Kekkosen katu 4-6',
    city: 'Helsinki',
    capacity: 700,
  },
  {
    name: 'Nosturi',
    address: 'Telakkakatu 8',
    city: 'Helsinki',
    capacity: 900,
  },
  {
    name: 'Kulttuuritalo',
    address: 'Sturenkatu 4',
    city: 'Helsinki',
    capacity: 1500,
  },
  {
    name: 'Helsingin Jäähalli',
    address: 'Nordenskiöldinkatu 11-13',
    city: 'Helsinki',
    capacity: 8200,
  },
  {
    name: 'Olympiastadion',
    address: 'Paavo Nurmen tie 1',
    city: 'Helsinki',
    capacity: 50000,
  },
  {
    name: 'Pakkahuone',
    address: 'Itäinen katu 8',
    city: 'Tampere',
    capacity: 1500,
  },
];

const ARTISTS: { name: string; genres: string[] }[] = [
  { name: 'Batham', genres: ['Metal', 'Heavy Metal'] },
  { name: 'Nightwish', genres: ['Symphonic Metal', 'Metal'] },
  { name: 'Amorphis', genres: ['Metal', 'Death Metal'] },
  { name: 'Insomnium', genres: ['Death Metal', 'Metal'] },
  { name: 'Apocalyptica', genres: ['Metal', 'Classical'] },
  { name: 'Battle Beast', genres: ['Heavy Metal'] },
  { name: 'Haloo Helsinki!', genres: ['Suomipop', 'Pop'] },
  { name: 'Ricky-Tick Big Band', genres: ['Jazz'] },
  { name: 'Pää Kii', genres: ['Punk'] },
];

const USERS = [
  { username: 'alice', displayName: 'Alice' },
  { username: 'bob', displayName: 'Bob' },
  { username: 'carol', displayName: 'Carol' },
];

const daysFromNow = (days: number, hour = 19) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  const genres = new Map(
    (await prisma.genre.findMany()).map((g) => [g.name, g.id]),
  );
  if (genres.size === 0) {
    throw new Error(
      'No genres found. Run migrations first (they include the genre list).',
    );
  }

  for (const v of VENUES) {
    const slug = slugify(`${v.name} ${v.city}`);
    await prisma.venue.upsert({
      where: { slug },
      create: { ...v, slug },
      update: v,
    });
  }
  const venues = new Map(
    (await prisma.venue.findMany()).map((v) => [v.name, v.id]),
  );

  for (const a of ARTISTS) {
    const slug = slugify(a.name);
    const artist = await prisma.artist.upsert({
      where: { slug },
      create: { name: a.name, slug },
      update: {},
    });
    await prisma.artistGenre.createMany({
      data: a.genres.map((g) => ({
        artistId: artist.id,
        genreId: genres.get(g)!,
      })),
      skipDuplicates: true,
    });
  }
  const artists = new Map(
    (await prisma.artist.findMany()).map((a) => [a.name, a.id]),
  );

  const passwordHash = await argon2.hash(password);
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { username: u.username },
      create: { ...u, email: `${u.username}@example.com`, passwordHash },
      // Re-seeding with a new SEED_PASSWORD rotates the demo password.
      update: { passwordHash },
    });
  }
  const users = new Map(
    (await prisma.user.findMany()).map((u) => [u.username, u.id]),
  );
  const alice = users.get('alice')!;
  const bob = users.get('bob')!;
  const carol = users.get('carol')!;

  // alice <-> bob are friends; carol has a pending request to alice.
  await prisma.friendship.createMany({
    data: [
      { userId: alice, friendId: bob },
      { userId: bob, friendId: alice },
    ],
    skipDuplicates: true,
  });
  await prisma.friendRequest.upsert({
    where: {
      requesterId_addresseeId: { requesterId: alice, addresseeId: bob },
    },
    create: { requesterId: alice, addresseeId: bob, status: 'ACCEPTED' },
    update: {},
  });
  await prisma.friendRequest.upsert({
    where: {
      requesterId_addresseeId: { requesterId: carol, addresseeId: alice },
    },
    create: { requesterId: carol, addresseeId: alice },
    update: {},
  });

  const seedUserIds = [...users.values()];
  await prisma.event.deleteMany({
    where: { createdById: { in: seedUserIds } },
  });

  const events = [
    {
      title: 'Batham – album release show',
      description:
        'New album, loud amps, cheap beer. #metal #albumrelease #helsinki',
      startsAt: daysFromNow(10, 21),
      doorsAt: daysFromNow(10, 20),
      venue: 'Bar Loose',
      artists: ['Batham'],
      genres: ['Heavy Metal'],
      priceMinCents: 1000,
      priceMaxCents: 1000,
      minAge: 18,
      accessibility: [] as const,
      by: alice,
      going: [bob],
      interested: [carol],
    },
    {
      title: 'Amorphis & Insomnium',
      description: 'Finnish melodic death metal double bill. #metal #melodeath',
      startsAt: daysFromNow(21),
      doorsAt: daysFromNow(21, 18),
      venue: 'Tavastia',
      artists: ['Amorphis', 'Insomnium'],
      genres: ['Death Metal', 'Metal'],
      priceMinCents: 4500,
      priceMaxCents: 5500,
      minAge: 18,
      accessibility: ['WHEELCHAIR_ACCESS', 'ACCESSIBLE_TOILET'] as const,
      by: bob,
      going: [alice, bob],
      interested: [],
    },
    {
      title: 'Nightwish',
      description: 'Arena tour. #symphonicmetal #arena',
      startsAt: daysFromNow(45),
      doorsAt: daysFromNow(45, 17),
      venue: 'Helsingin Jäähalli',
      artists: ['Nightwish', 'Battle Beast'],
      genres: ['Symphonic Metal'],
      priceMinCents: 6900,
      priceMaxCents: 12900,
      minAge: null,
      accessibility: [
        'WHEELCHAIR_ACCESS',
        'STEP_FREE_ACCESS',
        'HEARING_LOOP',
        'SEATING_AVAILABLE',
        'COMPANION_TICKET',
      ] as const,
      by: alice,
      going: [carol],
      interested: [bob],
    },
    {
      title: 'Ricky-Tick Big Band – Christmas swing',
      description: 'Big band classics for the whole family. #jazz #christmas',
      startsAt: daysFromNow(30, 18),
      venue: 'Kulttuuritalo',
      artists: ['Ricky-Tick Big Band'],
      genres: ['Jazz'],
      priceMinCents: 3500,
      priceMaxCents: 5900,
      minAge: null,
      accessibility: ['WHEELCHAIR_ACCESS', 'SEATING_AVAILABLE'] as const,
      by: carol,
      going: [],
      interested: [alice],
    },
    {
      title: 'Pää Kii – free gig',
      description: 'Free entry, first come first served. #punk #free',
      startsAt: daysFromNow(5, 20),
      venue: 'Nosturi',
      artists: ['Pää Kii'],
      genres: ['Punk'],
      priceMinCents: 0,
      priceMaxCents: 0,
      minAge: 18,
      accessibility: [] as const,
      by: bob,
      going: [carol],
      interested: [],
    },
    {
      title: 'Haloo Helsinki! stadium show',
      description: '#suomipop #stadium',
      startsAt: daysFromNow(200, 18),
      venue: 'Olympiastadion',
      artists: ['Haloo Helsinki!'],
      genres: ['Suomipop'],
      priceMinCents: 7900,
      priceMaxCents: 14900,
      minAge: null,
      accessibility: [
        'WHEELCHAIR_ACCESS',
        'STEP_FREE_ACCESS',
        'ACCESSIBLE_TOILET',
      ] as const,
      by: carol,
      going: [bob],
      interested: [],
    },
  ];

  for (const e of events) {
    const tags = collectHashtags([], e.description);
    await prisma.hashtag.createMany({
      data: tags.map((tag) => ({ tag })),
      skipDuplicates: true,
    });
    const hashtagIds = (
      await prisma.hashtag.findMany({ where: { tag: { in: tags } } })
    ).map((h) => h.id);
    await prisma.event.create({
      data: {
        title: e.title,
        description: e.description,
        startsAt: e.startsAt,
        doorsAt: 'doorsAt' in e ? e.doorsAt : undefined,
        venueId: venues.get(e.venue)!,
        createdById: e.by,
        ticketUrl: `https://example.com/tickets/${slugify(e.title)}`,
        priceMinCents: e.priceMinCents,
        priceMaxCents: e.priceMaxCents,
        minAge: e.minAge,
        accessibility: [...e.accessibility],
        artists: {
          create: e.artists.map((name, i) => ({
            artistId: artists.get(name)!,
            isHeadliner: i === 0,
            sortOrder: i,
          })),
        },
        genres: { create: e.genres.map((g) => ({ genreId: genres.get(g)! })) },
        hashtags: { create: hashtagIds.map((hashtagId) => ({ hashtagId })) },
        attendances: {
          create: [
            ...e.going.map((userId) => ({ userId, status: 'GOING' as const })),
            ...e.interested.map((userId) => ({
              userId,
              status: 'INTERESTED' as const,
            })),
          ],
        },
      },
    });
  }

  console.log(
    `Seeded ${dbHost}: ${VENUES.length} venues, ${ARTISTS.length} artists, ${USERS.length} users, ${events.length} events.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
