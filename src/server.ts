import handler from '@tanstack/react-start/server-entry'

import { consumeBrowserEvents, runRetentionCleanup } from '#/ingest/consumer'

const worker = {
  fetch(request) {
    return handler.fetch(request)
  },
  queue: consumeBrowserEvents,
  scheduled(_controller, environment, context) {
    context.waitUntil(runRetentionCleanup(environment))
  },
} satisfies ExportedHandler<Cloudflare.Env>

export default worker
