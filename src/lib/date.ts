const utcDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function formatUtcDate(date: Date) {
  return utcDateFormatter.format(date)
}

export function formatZonedDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function addCalendarDays(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return formatUtcDate(new Date(Date.UTC(year, month - 1, day + days)))
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)

  const values: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value
  }

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  )
  return asUtc - date.getTime()
}

/** Convert a wall-clock local datetime in `timeZone` to a UTC Date. */
export function zonedDateTimeToUtc(
  dateStr: string,
  timeZone: string,
  hour = 0,
  minute = 0,
  second = 0,
) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const offset = getTimeZoneOffsetMs(guess, timeZone)
  let utc = new Date(guess.getTime() - offset)
  const refinedOffset = getTimeZoneOffsetMs(utc, timeZone)
  if (refinedOffset !== offset) {
    utc = new Date(guess.getTime() - refinedOffset)
  }
  return utc
}

export function resolveTimeZone(timeZone: string | undefined) {
  if (!timeZone) return 'UTC'
  try {
    formatZonedDate(new Date(), timeZone)
    return timeZone
  } catch {
    return 'UTC'
  }
}

/**
 * Map "last `days` local calendar days ending today" into:
 * - local inclusive/exclusive date labels
 * - UTC date bounds that fully cover that local window for `utc_date` filters
 */
export function recentDaysRange(days: number, timeZone: string, now = new Date()) {
  const tz = resolveTimeZone(timeZone)
  const todayLocal = formatZonedDate(now, tz)
  const fromLocal = addCalendarDays(todayLocal, -(days - 1))
  const toLocalExclusive = addCalendarDays(todayLocal, 1)

  const fromInstant = zonedDateTimeToUtc(fromLocal, tz)
  const toInstant = zonedDateTimeToUtc(toLocalExclusive, tz)
  const lastOverlappingUtcDate = formatUtcDate(new Date(toInstant.getTime() - 1))

  return {
    timeZone: tz,
    from: fromLocal,
    to: toLocalExclusive,
    fromMs: fromInstant.getTime(),
    toMs: toInstant.getTime(),
    utcFrom: formatUtcDate(fromInstant),
    utcToExclusive: addCalendarDays(lastOverlappingUtcDate, 1),
  }
}

export function weekBucketStart(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekday = (date.getUTCDay() + 6) % 7
  return addCalendarDays(dateStr, -weekday)
}

export function monthBucketStart(dateStr: string) {
  return `${dateStr.slice(0, 8)}01`
}
