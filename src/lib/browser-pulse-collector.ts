export type BrowserPulseCollectResult =
  | { status: 'accepted' }
  | { status: 'rejected'; reason: string; message?: string }

export type BrowserPulseDetectResult = {
  browserFamily: string
  browserMajor: string | null
  osFamily: string
  deviceClass: string
  detectionSource: string
  snippetVersion: string
}

type Brand = { brand: string; version: string }

type NavigatorUAData = {
  brands?: Brand[]
  mobile?: boolean
  platform?: string
}

function matchBrowser(value: string, rules: Array<[RegExp, string]>) {
  for (const [pattern, family] of rules) {
    const found = value.match(pattern)
    if (found) return { family, major: found[1] || null }
  }
  return null
}

export function detectBrowserPulseEnvironment(): BrowserPulseDetectResult {
  const ua = navigator.userAgent || ''
  const data = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData
  let browser: { family: string; major: string | null } | null = null
  let detectionSource = 'unknown'

  if (data?.brands) {
    const rules: Array<[RegExp, string]> = [
      [/Microsoft Edge/i, 'Edge'],
      [/\bOpera\b/i, 'Opera'],
      [/Google Chrome/i, 'Chrome'],
      [/\bChromium\b/i, 'Chrome'],
    ]
    for (const [pattern, family] of rules) {
      const brand = data.brands.find((item) => pattern.test(item.brand))
      if (brand) {
        browser = {
          family,
          major: /^\d+/u.exec(String(brand.version))?.[0] || null,
        }
        detectionSource = 'ua_ch'
        break
      }
    }
  }

  if (!browser) {
    browser = matchBrowser(ua, [
      [/SamsungBrowser\/(\d+)/u, 'Samsung Internet'],
      [/Edg(?:A|iOS)?\/(\d+)/u, 'Edge'],
      [/OPR\/(\d+)/u, 'Opera'],
      [/CriOS\/(\d+)/u, 'Chrome'],
      [/Chrome\/(\d+)/u, 'Chrome'],
      [/FxiOS\/(\d+)/u, 'Firefox'],
      [/Firefox\/(\d+)/u, 'Firefox'],
      [/Version\/(\d+).+Safari\//u, 'Safari'],
    ])
    if (browser) detectionSource = 'user_agent_fallback'
  }

  const touchMac = /Macintosh/u.test(ua) && Number(navigator.maxTouchPoints) > 1
  const platform = String(data?.platform || '').toLowerCase()
  const platforms: Record<string, string> = {
    windows: 'Windows',
    macos: 'macOS',
    ios: 'iOS',
    android: 'Android',
    linux: 'Linux',
    'chrome os': 'ChromeOS',
  }
  let osFamily = platforms[platform]
  if (!osFamily) {
    if (/iPhone|iPad|iPod/u.test(ua) || touchMac) osFamily = 'iOS'
    else if (/Android/u.test(ua)) osFamily = 'Android'
    else if (/Windows NT/u.test(ua)) osFamily = 'Windows'
    else if (/CrOS/u.test(ua)) osFamily = 'ChromeOS'
    else if (/Macintosh|Mac OS X/u.test(ua)) osFamily = 'macOS'
    else if (/Linux/u.test(ua)) osFamily = 'Linux'
    else osFamily = ua || platform ? 'Other' : 'Unknown'
  }

  let deviceClass = 'Unknown'
  if (/iPad/u.test(ua) || touchMac || (/Android/u.test(ua) && !/Mobile/u.test(ua))) {
    deviceClass = 'Tablet'
  } else if (data?.mobile || /iPhone|iPod|Android.+Mobile|Mobile/u.test(ua)) {
    deviceClass = 'Mobile'
  } else if (['Windows', 'macOS', 'Linux', 'ChromeOS'].includes(osFamily)) {
    deviceClass = 'Desktop'
  } else if (ua || platform) {
    deviceClass = 'Other'
  }

  return {
    browserFamily: browser?.family || 'Unknown',
    browserMajor: browser?.major || null,
    osFamily,
    deviceClass,
    detectionSource,
    snippetVersion: '1.0.0',
  }
}

export function buildCollectorEndpoint(collectorOrigin: string, collectorKey: string) {
  return new URL(
    `/v1/browser-events/${encodeURIComponent(collectorKey)}`,
    collectorOrigin,
  ).toString()
}

export function createBrowserPulseCollector(endpoint: string) {
  let firstRequest: Promise<BrowserPulseCollectResult> | undefined

  return function collectBrowserPulse(): Promise<BrowserPulseCollectResult> {
    if (firstRequest) return firstRequest

    firstRequest = fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(detectBrowserPulseEnvironment()),
      keepalive: true,
    })
      .then((response): BrowserPulseCollectResult => {
        if (response.status === 202) return { status: 'accepted' }
        const reasons: Record<number, string> = {
          400: 'invalid_payload',
          401: 'invalid_key',
          403: 'origin_not_allowed',
          413: 'invalid_payload',
          429: 'rate_limited',
        }
        return {
          status: 'rejected',
          reason: reasons[response.status] || 'server_error',
        }
      })
      .catch(
        (): BrowserPulseCollectResult => ({
          status: 'rejected',
          reason: 'network_error',
        }),
      )

    return firstRequest
  }
}
