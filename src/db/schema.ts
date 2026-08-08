import { relations } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const timestamps = () => ({
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
})

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
  image: text('image'),
  ...timestamps(),
})

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps(),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
)

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    scope: text('scope'),
    password: text('password'),
    ...timestamps(),
  },
  (table) => [
    index('account_user_id_idx').on(table.userId),
    uniqueIndex('account_provider_account_unique').on(table.providerId, table.accountId),
  ],
)

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    ...timestamps(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    ...timestamps(),
  },
  (table) => [index('workspaces_owner_user_id_idx').on(table.ownerUserId)],
)

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: text('status', { enum: ['active', 'disabled'] })
      .default('active')
      .notNull(),
    lastSuccessfulCollectionAt: integer('last_successful_collection_at', {
      mode: 'timestamp_ms',
    }),
    lastRejectedReason: text('last_rejected_reason'),
    lastRejectedAt: integer('last_rejected_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (table) => [index('projects_workspace_id_idx').on(table.workspaceId)],
)

export const allowedOrigins = sqliteTable(
  'allowed_origins',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    origin: text('origin').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('allowed_origins_project_origin_unique').on(table.projectId, table.origin),
    index('allowed_origins_project_id_idx').on(table.projectId),
  ],
)

export const collectorKeys = sqliteTable(
  'collector_keys',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    publicId: text('public_id').notNull().unique(),
    version: integer('version').default(1).notNull(),
    name: text('name').default('默认采集键').notNull(),
    status: text('status', { enum: ['active', 'revoked'] })
      .default('active')
      .notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('collector_keys_public_version_unique').on(table.publicId, table.version),
    index('collector_keys_project_id_idx').on(table.projectId),
  ],
)

export const supportPolicies = sqliteTable(
  'support_policies',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    browserFamily: text('browser_family').notNull(),
    minimumSupportedMajor: integer('minimum_supported_major').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.browserFamily] })],
)

export const rawEvents = sqliteTable(
  'raw_events',
  {
    ingestId: text('ingest_id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    collectedAt: integer('collected_at', { mode: 'timestamp_ms' }).notNull(),
    browserFamily: text('browser_family').notNull(),
    browserMajor: text('browser_major'),
    osFamily: text('os_family').notNull(),
    deviceClass: text('device_class').notNull(),
    detectionSource: text('detection_source').notNull(),
    snippetVersion: text('snippet_version').notNull(),
  },
  (table) => [index('raw_events_project_collected_idx').on(table.projectId, table.collectedAt)],
)

export const dailyAggregates = sqliteTable(
  'daily_aggregates',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    utcDate: text('utc_date').notNull(),
    browserFamily: text('browser_family').notNull(),
    browserMajor: text('browser_major').default('').notNull(),
    osFamily: text('os_family').notNull(),
    deviceClass: text('device_class').notNull(),
    detectionSource: text('detection_source').notNull(),
    eventCount: integer('event_count').default(0).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.projectId,
        table.utcDate,
        table.browserFamily,
        table.browserMajor,
        table.osFamily,
        table.deviceClass,
        table.detectionSource,
      ],
    }),
  ],
)

export const workspaceRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(user, {
    fields: [workspaces.ownerUserId],
    references: [user.id],
  }),
  projects: many(projects),
}))

export const projectRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  origins: many(allowedOrigins),
  collectorKeys: many(collectorKeys),
}))

export const schema = {
  user,
  session,
  account,
  verification,
  workspaces,
  projects,
  allowedOrigins,
  collectorKeys,
  supportPolicies,
  rawEvents,
  dailyAggregates,
}
