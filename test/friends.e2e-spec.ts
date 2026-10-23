import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  authed,
  createTestApp,
  registerUser,
  resetDatabase,
  type TestUser,
} from './helpers.js';

describe('Friends (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    alice = await registerUser(app, 'alice');
    bob = await registerUser(app, 'bob');
    carol = await registerUser(app, 'carol');
  });
  afterAll(() => app.close());

  const as = (u: TestUser) => authed(app, u);

  it('request -> accept creates a mutual friendship', async () => {
    const req = await as(alice)
      .post('/friend-requests')
      .send({ userId: bob.id })
      .expect(201);
    await as(alice)
      .post('/friend-requests')
      .send({ userId: bob.id })
      .expect(409);

    const incoming = await as(bob)
      .get('/friend-requests?direction=incoming')
      .expect(200);
    expect(incoming.body.map((r: any) => r.requester.username)).toEqual([
      'alice',
    ]);

    // Only the addressee may accept.
    await as(alice).post(`/friend-requests/${req.body.id}/accept`).expect(404);
    await as(bob).post(`/friend-requests/${req.body.id}/accept`).expect(200);

    expect(
      (await as(alice).get('/me/friends')).body.map((f: any) => f.username),
    ).toEqual(['bob']);
    expect(
      (await as(bob).get('/me/friends')).body.map((f: any) => f.username),
    ).toEqual(['alice']);
    expect((await as(alice).get('/users/bob')).body.relationship).toBe(
      'friends',
    );
    await as(alice)
      .post('/friend-requests')
      .send({ userId: bob.id })
      .expect(409);
  });

  it('a counter-request auto-accepts the pending one', async () => {
    await as(carol)
      .post('/friend-requests')
      .send({ userId: alice.id })
      .expect(201);
    expect((await as(alice).get('/users/carol')).body.relationship).toBe(
      'request_received',
    );
    await as(alice)
      .post('/friend-requests')
      .send({ userId: carol.id })
      .expect(201);
    expect((await as(alice).get('/users/carol')).body.relationship).toBe(
      'friends',
    );
  });

  it('declined requests can be sent again; cancelled ones disappear', async () => {
    const req = await as(bob)
      .post('/friend-requests')
      .send({ userId: carol.id })
      .expect(201);
    await as(carol).post(`/friend-requests/${req.body.id}/decline`).expect(200);
    const again = await as(bob)
      .post('/friend-requests')
      .send({ userId: carol.id })
      .expect(201);
    expect(again.body.status).toBe('PENDING');
    await as(bob).delete(`/friend-requests/${again.body.id}`).expect(204);
    expect((await as(carol).get('/friend-requests')).body).toEqual([]);
  });

  it('cannot befriend yourself or unknown users', async () => {
    await as(alice)
      .post('/friend-requests')
      .send({ userId: alice.id })
      .expect(400);
    await as(alice)
      .post('/friend-requests')
      .send({ userId: '00000000-0000-4000-8000-000000000000' })
      .expect(404);
  });

  it('unfriending removes both directions', async () => {
    await as(bob).delete(`/me/friends/${alice.id}`).expect(204);
    expect(
      (await as(alice).get('/me/friends')).body.map((f: any) => f.username),
    ).toEqual(['carol']);
    await as(bob).delete(`/me/friends/${alice.id}`).expect(404);
  });

  it('searches users by partial name', async () => {
    const res = await as(alice).get('/users?q=CAR').expect(200);
    expect(res.body.items.map((u: any) => u.username)).toEqual(['carol']);
    expect(res.body.items[0]).not.toHaveProperty('email');
  });
});
