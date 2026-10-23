import { execSync } from 'node:child_process';
import { config } from 'dotenv';

/** Runs once before all e2e files: brings the test database schema up to date. */
export default function setup() {
  const env = config({ path: '.env.test', quiet: true }).parsed ?? {};
  if (!env.DATABASE_URL?.includes('_test')) {
    throw new Error(
      'Refusing to run e2e tests: .env.test DATABASE_URL must point at a *_test database',
    );
  }
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
}
