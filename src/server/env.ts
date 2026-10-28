import 'server-only'
import { z } from 'zod'

/**
 * Server-only configuration. Everything is optional for local use:
 * with no DATABASE_URL the app uses an in-memory store (accounts and saved
 * games vanish on restart). Set DATABASE_URL to a MongoDB connection string
 * to keep them. The game itself never needs the server.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('memory://local'),
  AUTH_SECRET: z.string().optional(),
  AUTH_URL: z.string().url().optional(),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export function env(): Env {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) throw new ConfigError(`Invalid server configuration: ${parsed.error.issues.map((i) => i.message).join('; ')}`)
  cached = parsed.data
  return cached
}

export function appUrl(): string {
  return (env().AUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

export function isSecureCookies(): boolean {
  return appUrl().startsWith('https://')
}
