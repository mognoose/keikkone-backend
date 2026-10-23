import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default('*'),
  // Number of reverse proxies in front of the app (Cloud Run: 1). Needed so
  // req.ip is the client's IP and not the load balancer's; rate limiting
  // depends on it. Keep 0 when directly exposed, or X-Forwarded-For is spoofable.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  SWAGGER_ENABLED: z.stringbool().default(true),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Used as ConfigModule's `validate` hook: the app refuses to boot with a
 * missing or malformed environment instead of failing later at runtime.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
