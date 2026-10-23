import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // The CLI (migrations) prefers a direct connection: Neon's pooled URL goes
    // through PgBouncer, which doesn't support the session-level locks that
    // migrate uses. The app itself keeps using the pooled DATABASE_URL.
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
});
