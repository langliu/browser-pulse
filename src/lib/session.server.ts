import { getRequestHeaders } from '@tanstack/react-start/server'

import { getAuth, getAuthConfiguration } from './auth'

export interface SessionUser {
  id: string
  name: string
  email: string
  image: string | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!getAuthConfiguration().ready) return null

  const session = await getAuth().api.getSession({
    headers: getRequestHeaders(),
    query: {
      disableCookieCache: true,
    },
  })
  if (!session) return null

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}
