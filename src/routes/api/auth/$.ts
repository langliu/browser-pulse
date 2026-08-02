import { createFileRoute } from '@tanstack/react-router'

import { AuthConfigurationError, getAuth, getAuthConfiguration } from '#/lib/auth'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: handleAuthRequest,
      POST: handleAuthRequest,
    },
  },
})

function handleAuthRequest({ request }: { request: Request }) {
  const configuration = getAuthConfiguration()
  if (!configuration.ready) {
    return Response.json(
      {
        error: 'auth_not_configured',
        missing: configuration.missing,
      },
      { status: 503 },
    )
  }

  try {
    return getAuth().handler(request)
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return Response.json(
        { error: 'auth_not_configured', missing: error.missing },
        { status: 503 },
      )
    }
    throw error
  }
}
