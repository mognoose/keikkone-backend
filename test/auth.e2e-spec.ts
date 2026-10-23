import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, registerUser, resetDatabase } from './helpers.js';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
  });
  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());

  it('registers, logs in and reads /me', async () => {
    await registerUser(app, 'sapatti');
    const login = await http()
      .post('/auth/login')
      .send({ email: 'SAPATTI@example.com', password: 'password123' })
      .expect(200);
    const me = await http()
      .get('/me')
      .auth(login.body.accessToken, { type: 'bearer' })
      .expect(200);
    expect(me.body).toMatchObject({
      username: 'sapatti',
      email: 'sapatti@example.com',
      role: 'USER',
    });
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it('rejects duplicate emails/usernames and bad input', async () => {
    await http()
      .post('/auth/register')
      .send({
        email: 'sapatti@example.com',
        username: 'other',
        displayName: 'x',
        password: 'password123',
      })
      .expect(409);
    const bad = await http()
      .post('/auth/register')
      .send({
        email: 'nope',
        username: 'A!',
        displayName: 'x',
        password: 'short',
        isAdmin: true,
      })
      .expect(400);
    expect(bad.body.message).toEqual(
      expect.arrayContaining(['property isAdmin should not exist']),
    );
  });

  it('gives the same error for unknown email and wrong password', async () => {
    const a = await http()
      .post('/auth/login')
      .send({ email: 'ghost@example.com', password: 'x' })
      .expect(401);
    const b = await http()
      .post('/auth/login')
      .send({ email: 'sapatti@example.com', password: 'wrong' })
      .expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('rotates refresh tokens and revokes all sessions on reuse', async () => {
    const user = await registerUser(app, 'rotator');
    const first = await http()
      .post('/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(200);
    expect(first.body.refreshToken).not.toBe(user.refreshToken);

    // Replaying the old token looks like theft...
    await http()
      .post('/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
    // ...so even the newest token is now dead.
    await http()
      .post('/auth/refresh')
      .send({ refreshToken: first.body.refreshToken })
      .expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const user = await registerUser(app, 'leaver');
    await http()
      .post('/auth/logout')
      .send({ refreshToken: user.refreshToken })
      .expect(204);
    await http()
      .post('/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });

  it('protects routes and rejects garbage tokens', async () => {
    await http().get('/me').expect(401);
    await http().get('/me').auth('garbage', { type: 'bearer' }).expect(401);
  });
});
