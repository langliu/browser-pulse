export function buildCollectorSnippet(collectorOrigin: string, collectorKey: string) {
  const endpoint = new URL(
    `/v1/browser-events/${encodeURIComponent(collectorKey)}`,
    collectorOrigin,
  ).toString()

  return `<script>
const collectBrowserPulse = (() => {
  let firstRequest;
  const match = (value, rules) => {
    for (const [pattern, family] of rules) {
      const found = value.match(pattern);
      if (found) return { family, major: found[1] || null };
    }
    return null;
  };
  const detect = () => {
    const ua = navigator.userAgent || "";
    const data = navigator.userAgentData;
    let browser = null;
    let detectionSource = "unknown";
    if (data?.brands) {
      const rules = [
        [/Microsoft Edge/i, "Edge"],
        [/\\bOpera\\b/i, "Opera"],
        [/Google Chrome/i, "Chrome"],
        [/\\bChromium\\b/i, "Chrome"],
      ];
      for (const [pattern, family] of rules) {
        const brand = data.brands.find((item) => pattern.test(item.brand));
        if (brand) {
          browser = { family, major: /^\\d+/.exec(String(brand.version))?.[0] || null };
          detectionSource = "ua_ch";
          break;
        }
      }
    }
    if (!browser) {
      browser = match(ua, [
        [/SamsungBrowser\\/(\\d+)/, "Samsung Internet"],
        [/Edg(?:A|iOS)?\\/(\\d+)/, "Edge"],
        [/OPR\\/(\\d+)/, "Opera"],
        [/CriOS\\/(\\d+)/, "Chrome"],
        [/Chrome\\/(\\d+)/, "Chrome"],
        [/FxiOS\\/(\\d+)/, "Firefox"],
        [/Firefox\\/(\\d+)/, "Firefox"],
        [/Version\\/(\\d+).+Safari\\//, "Safari"],
      ]);
      if (browser) detectionSource = "user_agent_fallback";
    }
    const touchMac = /Macintosh/.test(ua) && Number(navigator.maxTouchPoints) > 1;
    const platform = String(data?.platform || "").toLowerCase();
    const platforms = {
      windows: "Windows", macos: "macOS", ios: "iOS",
      android: "Android", linux: "Linux", "chrome os": "ChromeOS",
    };
    let osFamily = platforms[platform];
    if (!osFamily) {
      if (/iPhone|iPad|iPod/.test(ua) || touchMac) osFamily = "iOS";
      else if (/Android/.test(ua)) osFamily = "Android";
      else if (/Windows NT/.test(ua)) osFamily = "Windows";
      else if (/CrOS/.test(ua)) osFamily = "ChromeOS";
      else if (/Macintosh|Mac OS X/.test(ua)) osFamily = "macOS";
      else if (/Linux/.test(ua)) osFamily = "Linux";
      else osFamily = ua || platform ? "Other" : "Unknown";
    }
    let deviceClass = "Unknown";
    if (/iPad/.test(ua) || touchMac || (/Android/.test(ua) && !/Mobile/.test(ua))) {
      deviceClass = "Tablet";
    } else if (data?.mobile || /iPhone|iPod|Android.+Mobile|Mobile/.test(ua)) {
      deviceClass = "Mobile";
    } else if (["Windows", "macOS", "Linux", "ChromeOS"].includes(osFamily)) {
      deviceClass = "Desktop";
    } else if (ua || platform) deviceClass = "Other";
    return {
      browserFamily: browser?.family || "Unknown",
      browserMajor: browser?.major || null,
      osFamily,
      deviceClass,
      detectionSource,
      snippetVersion: "1.0.0",
    };
  };
  return function collectBrowserPulse() {
    if (firstRequest) return firstRequest;
    firstRequest = fetch(${JSON.stringify(endpoint)}, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(detect()),
      keepalive: true,
    }).then((response) => {
      if (response.status === 202) return { status: "accepted" };
      const reasons = {
        400: "invalid_payload", 401: "invalid_key", 403: "origin_not_allowed",
        413: "invalid_payload", 429: "rate_limited",
      };
      return { status: "rejected", reason: reasons[response.status] || "server_error" };
    }).catch(() => ({ status: "rejected", reason: "network_error" }));
    return firstRequest;
  };
})();
</script>`
}
