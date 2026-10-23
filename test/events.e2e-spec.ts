import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  authed,
  createTestApp,
  inDays,
  makeFriends,
  registerUser,
  resetDatabase,
  seedCatalog,
  type TestUser,
} from './helpers.js';

describe('Events (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;
  let alice: TestUser;
  let bob: TestUser;
  let stranger: TestUser;
  let metalGigId: string;
  let jazzGigId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    catalog = await seedCatalog(prisma);
    alice = await registerUser(app, 'alice');
    bob = await registerUser(app, 'bob');
    stranger = await registerUser(app, 'stranger');
    await makeFriends(app, alice, bob);
  });
  afterAll(() => app.close());

  const anon = () => request(app.getHttpServer());
  const titles = (res: request.Response) =>
    res.body.items.map((e: any) => e.title);

  describe('creating', () => {
    it('requires login', async () => {
      await anon().post('/events').send({}).expect(401);
    });

    it('creates an event with hashtags from both the field and the description', async () => {
      const res = await authed(app, alice)
        .post('/events')
        .send({
          title: 'Batham live',
          description:
            'Loud night. #Metal #helsinki see https://x.fi/#not-a-tag',
          startsAt: inDays(10),
          venueId: catalog.smallVenue.id,
          artists: [{ artistId: catalog.metalBand.id }],
          hashtags: ['#AlbumRelease', 'metal'],
          ticketUrl: 'https://example.com/tickets',
          priceMinCents: 1500,
          priceMaxCents: 2000,
          minAge: 18,
          accessibility: ['WHEELCHAIR_ACCESS'],
        })
        .expect(201);
      metalGigId = res.body.id;
      expect(res.body).toMatchObject({
        hashtags: ['albumrelease', 'helsinki', 'metal'],
        // Genres default to the artists' genres.
        genres: [{ slug: 'metal' }],
        artists: [{ slug: 'batham', isHeadliner: true }],
        venue: { size: 'SMALL' },
        price: {
          minCents: 1500,
          maxCents: 2000,
          currency: 'EUR',
          isFree: false,
        },
        minAge: 18,
        createdBy: { username: 'alice' },
      });
    });

    it('creates a free all-ages arena event', async () => {
      const res = await authed(app, bob)
        .post('/events')
        .send({
          title: 'Big Band in the arena',
          startsAt: inDays(20),
          venueId: catalog.arena.id,
          artists: [{ artistId: catalog.jazzBand.id }],
          priceMinCents: 0,
          priceMaxCents: 0,
          accessibility: ['WHEELCHAIR_ACCESS', 'HEARING_LOOP'],
        })
        .expect(201);
      jazzGigId = res.body.id;
      expect(res.body.price.isFree).toBe(true);
    });

    it('validates input and references', async () => {
      const base = {
        title: 'Bad',
        startsAt: inDays(5),
        venueId: catalog.smallVenue.id,
        artists: [{ artistId: catalog.metalBand.id }],
      };
      const user = authed(app, alice);
      await user
        .post('/events')
        .send({ ...base, endsAt: inDays(4) })
        .expect(400);
      await user
        .post('/events')
        .send({ ...base, priceMinCents: 500, priceMaxCents: 100 })
        .expect(400);
      await user
        .post('/events')
        .send({ ...base, artists: [] })
        .expect(400);
      await user
        .post('/events')
        .send({ ...base, genres: ['polka'] })
        .expect(400);
      await user
        .post('/events')
        .send({ ...base, venueId: '00000000-0000-4000-8000-000000000000' })
        .expect(400);
      await user
        .post('/events')
        .send({ ...base, accessibility: ['JETPACK'] })
        .expect(400);
    });
  });

  describe('searching', () => {
    it.each([
      ['venueSize=SMALL', ['Batham live']],
      ['venueSize=SMALL,ARENA', ['Batham live', 'Big Band in the arena']],
      ['minCapacity=1000', ['Big Band in the arena']],
      ['genre=jazz', ['Big Band in the arena']],
      ['hashtag=%23METAL', ['Batham live']],
      ['artist=batham', ['Batham live']],
      ['venue=bar-loose-helsinki', ['Batham live']],
      ['q=big%20band', ['Big Band in the arena']],
      ['free=true', ['Big Band in the arena']],
      ['priceMinCents=1000&priceMaxCents=1500', ['Batham live']],
      ['age=16', ['Big Band in the arena']],
      ['allAges=true', ['Big Band in the arena']],
      [
        'accessibility=WHEELCHAIR_ACCESS,HEARING_LOOP',
        ['Big Band in the arena'],
      ],
      ['city=helsinki&genre=metal&venueSize=SMALL', ['Batham live']],
      [`to=${encodeURIComponent(inDays(15))}`, ['Batham live']],
      [`from=${encodeURIComponent(inDays(15))}`, ['Big Band in the arena']],
      ['sort=price', ['Big Band in the arena', 'Batham live']],
    ])('GET /events?%s', async (qs, expected) => {
      expect(titles(await anon().get(`/events?${qs}`).expect(200))).toEqual(
        expected,
      );
    });

    it('paginates with a cursor', async () => {
      const first = await anon().get('/events?limit=1').expect(200);
      expect(titles(first)).toEqual(['Batham live']);
      const second = await anon()
        .get(`/events?limit=1&cursor=${first.body.nextCursor}`)
        .expect(200);
      expect(titles(second)).toEqual(['Big Band in the arena']);
      expect(second.body.nextCursor).toBeNull();
    });

    it('rejects invalid filters', async () => {
      await anon().get('/events?venueSize=HUGE').expect(400);
      await anon().get('/events?limit=1000').expect(400);
    });
  });

  describe('attendance & friends', () => {
    beforeAll(async () => {
      await authed(app, bob)
        .put(`/events/${metalGigId}/attendance`)
        .send({ status: 'GOING' })
        .expect(200);
      await authed(app, stranger)
        .put(`/events/${metalGigId}/attendance`)
        .send({ status: 'INTERESTED' })
        .expect(200);
      await authed(app, stranger)
        .put(`/events/${jazzGigId}/attendance`)
        .send({ status: 'GOING' })
        .expect(200);
    });

    it('anonymous users see counts but never who attends', async () => {
      const res = await anon().get(`/events/${metalGigId}`).expect(200);
      expect(res.body.attendance).toEqual({ going: 1, interested: 1 });
      expect(res.body).not.toHaveProperty('friendsAttending');
      expect(res.body).not.toHaveProperty('myAttendance');
    });

    it('logged-in users see only their friends among attendees', async () => {
      const res = await authed(app, alice)
        .get(`/events/${metalGigId}`)
        .expect(200);
      expect(res.body.attendance).toEqual({
        going: 1,
        interested: 1,
        friends: 1,
      });
      expect(res.body.myAttendance).toBeNull();
      expect(res.body.friendsAttending).toEqual([
        { user: expect.objectContaining({ username: 'bob' }), status: 'GOING' },
      ]);
    });

    it('filters by friends attending (login required)', async () => {
      await anon().get('/events?friendsAttending=true').expect(401);
      const res = await authed(app, alice)
        .get('/events?friendsAttending=true')
        .expect(200);
      expect(titles(res)).toEqual(['Batham live']);
    });

    it('feed lists events friends attend', async () => {
      const res = await authed(app, alice).get('/me/feed').expect(200);
      expect(res.body.items.map((e: any) => e.title)).toEqual(['Batham live']);
      expect((await authed(app, stranger).get('/me/feed')).body.items).toEqual(
        [],
      );
    });

    it('attendance can be changed and removed', async () => {
      const bobApi = authed(app, bob);
      const res = await bobApi
        .put(`/events/${metalGigId}/attendance`)
        .send({ status: 'INTERESTED' })
        .expect(200);
      expect(res.body.myAttendance).toBe('INTERESTED');
      await bobApi.delete(`/events/${metalGigId}/attendance`).expect(204);
      expect(
        (await bobApi.get(`/events/${metalGigId}`)).body.myAttendance,
      ).toBeNull();
    });
  });

  describe('editing', () => {
    it('only the creator (or an admin) can edit', async () => {
      await authed(app, bob)
        .patch(`/events/${metalGigId}`)
        .send({ title: 'Hijacked' })
        .expect(403);
      await prisma.user.update({
        where: { id: stranger.id },
        data: { role: 'ADMIN' },
      });
      // Role lives in the JWT, so the admin needs a fresh token.
      const login = await anon()
        .post('/auth/login')
        .send({ email: 'stranger@example.com', password: 'password123' });
      await anon()
        .patch(`/events/${metalGigId}`)
        .auth(login.body.accessToken, { type: 'bearer' })
        .send({ accessibilityNotes: 'Ramp at the side door' })
        .expect(200);
    });

    it('editing the description swaps its hashtags but keeps manual ones', async () => {
      const res = await authed(app, alice)
        .patch(`/events/${metalGigId}`)
        .send({ description: 'Now with #doom' })
        .expect(200);
      // "helsinki" and "metal" came from the old description; "albumrelease" was manual.
      expect(res.body.hashtags).toEqual(['albumrelease', 'doom']);
    });

    it('replaces artists when given', async () => {
      const res = await authed(app, alice)
        .patch(`/events/${metalGigId}`)
        .send({
          artists: [
            { artistId: catalog.jazzBand.id },
            { artistId: catalog.metalBand.id },
          ],
        })
        .expect(200);
      expect(res.body.artists.map((a: any) => [a.slug, a.isHeadliner])).toEqual(
        [
          ['big-band', true],
          ['batham', false],
        ],
      );
    });

    it('delete cancels instead of removing', async () => {
      await authed(app, alice).delete(`/events/${metalGigId}`).expect(204);
      expect(
        (await anon().get(`/events/${metalGigId}`).expect(200)).body.status,
      ).toBe('CANCELLED');
      expect(titles(await anon().get('/events'))).toEqual([
        'Big Band in the arena',
      ]);
      expect(
        titles(await anon().get('/events?includeCancelled=true')),
      ).toHaveLength(2);
      await authed(app, bob)
        .put(`/events/${metalGigId}/attendance`)
        .send({ status: 'GOING' })
        .expect(400);
    });
  });

  describe('catalog', () => {
    it('lists genres, hashtags and artist/venue pages', async () => {
      expect(
        (await anon().get('/genres')).body.map((g: any) => g.slug),
      ).toEqual(['jazz', 'metal']);
      expect((await anon().get('/hashtags?q=%23al')).body).toEqual([
        { tag: 'albumrelease', eventCount: 1 },
      ]);
      const venue = await anon().get('/venues/jaahalli-helsinki').expect(200);
      expect(venue.body).toMatchObject({ size: 'ARENA' });
      expect(venue.body.upcomingEvents.items).toHaveLength(1);
      await anon().get('/artists/nobody').expect(404);
    });

    it('creating a duplicate artist returns the existing slug', async () => {
      const res = await authed(app, alice)
        .post('/artists')
        .send({ name: 'BATHAM' })
        .expect(409);
      expect(res.body).toMatchObject({
        slug: 'batham',
        id: catalog.metalBand.id,
      });
    });
  });
});
