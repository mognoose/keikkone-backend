import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = configureApp(
    moduleRef.createNestApplication<NestExpressApplication>(),
  ) as unknown as INestApplication<App>;
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** Empties every table except Prisma's migration bookkeeping. */
export async function resetDatabase(prisma: PrismaService) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export interface TestUser {
  id: string;
  username: string;
  token: string;
  refreshToken: string;
}

export async function registerUser(
  app: INestApplication<App>,
  username: string,
): Promise<TestUser> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email: `${username}@example.com`,
      username,
      displayName: username,
      password: 'password123',
    })
    .expect(201);
  return {
    id: res.body.user.id,
    username,
    token: res.body.accessToken,
    refreshToken: res.body.refreshToken,
  };
}

/** Supertest requests pre-authenticated as `user`. */
export function authed(app: INestApplication<App>, user: TestUser) {
  const http = () => request(app.getHttpServer());
  const bearer = { type: 'bearer' } as const;
  return {
    get: (url: string) => http().get(url).auth(user.token, bearer),
    post: (url: string) => http().post(url).auth(user.token, bearer),
    put: (url: string) => http().put(url).auth(user.token, bearer),
    patch: (url: string) => http().patch(url).auth(user.token, bearer),
    delete: (url: string) => http().delete(url).auth(user.token, bearer),
  };
}

export async function makeFriends(
  app: INestApplication<App>,
  a: TestUser,
  b: TestUser,
) {
  const req = await request(app.getHttpServer())
    .post('/friend-requests')
    .auth(a.token, { type: 'bearer' })
    .send({ userId: b.id })
    .expect(201);
  await request(app.getHttpServer())
    .post(`/friend-requests/${req.body.id}/accept`)
    .auth(b.token, { type: 'bearer' })
    .expect(200);
}

/** Minimal catalog: one genre, two venues of different sizes, two artists. */
export async function seedCatalog(prisma: PrismaService) {
  const metal = await prisma.genre.create({
    data: { name: 'Metal', slug: 'metal' },
  });
  const jazz = await prisma.genre.create({
    data: { name: 'Jazz', slug: 'jazz' },
  });
  const smallVenue = await prisma.venue.create({
    data: {
      name: 'Bar Loose',
      slug: 'bar-loose-helsinki',
      address: 'Annankatu 21',
      city: 'Helsinki',
      capacity: 250,
    },
  });
  const arena = await prisma.venue.create({
    data: {
      name: 'Jäähalli',
      slug: 'jaahalli-helsinki',
      address: 'Nordenskiöldinkatu 11',
      city: 'Helsinki',
      capacity: 8200,
    },
  });
  const metalBand = await prisma.artist.create({
    data: {
      name: 'Batham',
      slug: 'batham',
      genres: { create: [{ genreId: metal.id }] },
    },
  });
  const jazzBand = await prisma.artist.create({
    data: {
      name: 'Big Band',
      slug: 'big-band',
      genres: { create: [{ genreId: jazz.id }] },
    },
  });
  return { metal, jazz, smallVenue, arena, metalBand, jazzBand };
}

export const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();
