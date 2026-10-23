# Keikkone backend

REST API for a concert-focused "Facebook Events": browse gigs, see which friends are going, and create events. It serves a headless web frontend and a mobile app.

**Stack:** NestJS 12 (native ESM) · PostgreSQL 17 · Prisma 7 (driver adapter `@prisma/adapter-pg`) · JWT auth (Passport) · Vitest · OpenAPI/Swagger

## Quick start

```zsh
nvm use                 # Node 24 (see .nvmrc)
npm install             # also runs `prisma generate` (postinstall)
cp .env.example .env    # then set JWT_ACCESS_SECRET: openssl rand -base64 48
npm run db:up           # Postgres in Docker on localhost:5433
npm run db:migrate      # apply migrations
npm run db:seed         # demo data (users alice/bob/carol, password: password123)
npm run start:dev       # http://localhost:3001
```

After the first setup, `npm run dev` runs the last four steps in one go.

- Swagger UI: http://localhost:3001/docs
- OpenAPI JSON (for client SDK generation): http://localhost:3001/docs-json
- Health: http://localhost:3001/health

## Scripts

| Script | What it does |
| --- | --- |
| `dev` | One-shot local start: `db:up` → `db:migrate` → `db:seed` → `start:dev` |
| `start:dev` | Watch mode |
| `build` / `start:prod` | Compile to `dist/` and run it |
| `test` | Unit tests (Vitest), co-located `*.spec.ts` |
| `test:e2e` | End-to-end tests against the `keikkone_test` DB. Migrates it automatically. |
| `lint` / `format` | oxlint / prettier |
| `db:up` · `db:migrate` · `db:seed` · `db:studio` | Docker Postgres, migrations, seed, Prisma Studio |

## Project layout

```
src/
  main.ts              bootstrap + Swagger
  app.setup.ts         global pipes/filters/helmet/CORS (shared with e2e tests)
  app.module.ts        root module: config, throttling, feature modules
  config/env.ts        zod-validated environment
  prisma/              global PrismaService (PrismaClient + pg adapter)
  common/              slugify, hashtag parsing, venue size buckets, pagination,
                       query-param transforms, Prisma→HTTP error filter
  auth/                register/login/refresh/logout, JwtStrategy, guards, decorators
  users/ friends/      profiles, search, friend requests, friend list
  events/              CRUD, search filters, attendance, feed
  artists/ venues/ genres/ hashtags/   catalog
  generated/prisma/    Prisma client (generated, git-ignored)
prisma/                schema, migrations, seed
test/                  e2e specs + helpers
```

## API overview

Public (no login): event search and details, artists, venues, genres, hashtags.
Login unlocks: creating content, attendance, friends, and the friend-aware data.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` |
| Me | `GET/PATCH /me`, `GET /me/friends`, `DELETE /me/friends/:userId`, `GET /me/feed` |
| Users | `GET /users?q=`, `GET /users/:username` (includes `relationship`) |
| Friend requests | `POST /friend-requests`, `GET /friend-requests?direction=incoming\|outgoing`, `POST /friend-requests/:id/accept\|decline`, `DELETE /friend-requests/:id` |
| Events | `GET /events`, `GET /events/:id`, `POST /events`, `PATCH /events/:id`, `DELETE /events/:id` (cancels), `PUT/DELETE /events/:id/attendance` |
| Catalog | `GET/POST /artists`, `GET /artists/:slug`, `GET/POST /venues`, `GET /venues/:slug`, `GET /genres`, `GET /hashtags?q=`, `GET /hashtags/trending`, `GET /hashtags/:tag/events` |

### `GET /events` filters

Filters combine with AND. List params accept `?genre=a&genre=b` or `?genre=a,b`, and the values inside one param combine with OR.

`q` (title/artist/venue/hashtag) · `artist` · `venue` · `city` · `genre` · `hashtag` · `venueSize` (`SMALL` <300, `MEDIUM` <1500, `LARGE` <5000, `ARENA`) · `minCapacity`/`maxCapacity` · `priceMinCents`/`priceMaxCents` (cheapest ticket) · `free` · `from`/`to` (default `from` = now) · `age` (events a person this age may attend) · `allAges` · `accessibility` (must have all listed) · `friendsAttending` (login) · `includeCancelled` · `sort=date|price` · `limit` · `cursor`

Pagination: responses are `{ items, nextCursor }`. Pass `nextCursor` back as `cursor`. `/me/feed` is ranked by number of friends attending, so it pages by `offset`.

## Design notes

- **Privacy.** Attendee identities are only shown to the attendee's friends (`friendsAttending`). Everyone sees aggregate counts. `GET /events/:id` uses `OptionalJwtAuthGuard`: anonymous requests pass through, but an invalid or expired token still returns 401, so clients know to refresh.
- **Friendships** are stored as two directed rows (A→B, B→A). "Friends of X" is then one indexed lookup, and "events my friends attend" is a plain relational filter. Sending a request to someone who already asked you auto-accepts.
- **Hashtags** come from the `hashtags` field plus `#words` in the description. They're lowercased, Unicode-aware (`#öljyä`) and deduplicated. When the description is edited, tags that came from the old description are replaced; manually added ones stay.
- **Prices** are integer cents (`priceMinCents`/`priceMaxCents`), which avoids float rounding. `sort=price` only includes events with a known price.
- **Age limit**: `minAge` null = all ages, 18 = K-18.
- **Deleting an event** sets `status = CANCELLED`, so attendees see "cancelled" instead of a 404.
- **Tokens.** Access tokens are 15-minute JWTs, checked without a DB lookup. Refresh tokens are random strings stored as SHA-256 hashes and rotated on every use. Replaying a used refresh token revokes all of that user's sessions. A role change only takes effect after the next refresh or login.
- **Search** uses `ILIKE` backed by `pg_trgm` GIN indexes, declared in `schema.prisma` so migrations don't drift.

## Gotchas found while setting this up

- `.npmrc` points this project at the public npm registry, because the global mirror (`npm.reg.lamia.fi`) lacks packages Nest 12 needs.
- npm's `latest` tag for `prisma` is currently an 8.0 **release candidate**. This repo pins Prisma 7.10.x; upgrade on purpose.
- npm 11 blocks dependency install scripts by default. The approvals are in `package.json` → `allowScripts` (Prisma engines, esbuild, argon2; the `@scarf/scarf` telemetry script is denied).
- Prisma 7 refuses destructive commands (`migrate reset`) when it detects an AI agent, unless a human explicitly consents.
- `prisma init` installed Prisma's agent skills into `.agents/`, `.claude/skills/`, `.windsurf/` and `skills-lock.json`. Delete them if you don't want them.

## Not built yet

Response DTOs in the OpenAPI spec (request DTOs are documented), image uploads, social login, email verification and password reset, notifications, moderation and reporting, "near me" geo search, and crawler/AI event ingestion.
