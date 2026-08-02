import { z } from 'zod'

export const browserFamilySchema = z.enum([
  'Chrome',
  'Edge',
  'Firefox',
  'Safari',
  'Opera',
  'Samsung Internet',
  'Other',
  'Unknown',
])

export const osFamilySchema = z.enum([
  'Windows',
  'macOS',
  'iOS',
  'Android',
  'Linux',
  'ChromeOS',
  'Other',
  'Unknown',
])

export const deviceClassSchema = z.enum(['Desktop', 'Mobile', 'Tablet', 'Other', 'Unknown'])

export const detectionSourceSchema = z.enum(['ua_ch', 'user_agent_fallback', 'unknown'])

export const browserEventSchema = z
  .object({
    browserFamily: browserFamilySchema,
    browserMajor: z.string().regex(/^\d+$/u).max(4).nullable(),
    osFamily: osFamilySchema,
    deviceClass: deviceClassSchema,
    detectionSource: detectionSourceSchema,
    snippetVersion: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/u)
      .max(24),
  })
  .strict()

export type BrowserEvent = z.infer<typeof browserEventSchema>

export const ingestMessageSchema = browserEventSchema.extend({
  ingestId: z.string().uuid(),
  projectId: z.string().uuid(),
  collectedAt: z.string().datetime({ offset: true }),
})

export type IngestMessage = z.infer<typeof ingestMessageSchema>
