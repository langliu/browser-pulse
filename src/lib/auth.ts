import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { env } from 'cloudflare:workers'

import { getDb } from '#/db'
import { schema } from '#/db/schema'

export interface AuthConfiguration {
  ready: boolean
  missing: string[]
}

export class AuthConfigurationError extends Error {
  constructor(readonly missing: string[]) {
    super(`缺少认证配置：${missing.join('、')}`)
    this.name = 'AuthConfigurationError'
  }
}

export function getAuthConfiguration(): AuthConfiguration {
  const required = {
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
  }
  const missing = Object.entries(required)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name)

  return { ready: missing.length === 0, missing }
}

const initialConfiguration = getAuthConfiguration()
const authInstance = initialConfiguration.ready
  ? betterAuth({
      appName: 'Browser Pulse',
      baseURL: env.BETTER_AUTH_URL,
      secret: env.BETTER_AUTH_SECRET,
      database: drizzleAdapter(getDb(), {
        provider: 'sqlite',
        schema,
      }),
      emailAndPassword: {
        enabled: false,
      },
      socialProviders: {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
          accessType: 'online',
        },
      },
      account: {
        storeStateStrategy: 'database',
        accountLinking: {
          enabled: false,
        },
      },
      session: {
        cookieCache: {
          enabled: false,
        },
      },
      advanced: {
        useSecureCookies: env.BETTER_AUTH_URL.startsWith('https://'),
        ipAddress: {
          disableIpTracking: true,
        },
        crossSubDomainCookies: {
          enabled: false,
        },
        cookiePrefix: 'browser-pulse',
      },
      databaseHooks: {
        account: {
          create: {
            before: async (account) => ({
              data: {
                ...account,
                accessToken: null,
                refreshToken: null,
                idToken: null,
                accessTokenExpiresAt: null,
                refreshTokenExpiresAt: null,
              },
            }),
          },
          update: {
            before: async (account) => ({
              data: {
                ...account,
                accessToken: null,
                refreshToken: null,
                idToken: null,
                accessTokenExpiresAt: null,
                refreshTokenExpiresAt: null,
              },
            }),
          },
        },
        session: {
          create: {
            before: async (session) => ({
              data: {
                ...session,
                ipAddress: null,
                userAgent: null,
              },
            }),
          },
          update: {
            before: async (session) => ({
              data: {
                ...session,
                ipAddress: null,
                userAgent: null,
              },
            }),
          },
        },
      },
      plugins: [tanstackStartCookies()],
    })
  : null

export function getAuth() {
  if (!authInstance) {
    throw new AuthConfigurationError(initialConfiguration.missing)
  }
  return authInstance
}
