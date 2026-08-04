# 数据采集与 User-Agent 识别

本文说明 Browser Pulse 当前版本如何采集浏览器环境信息、如何判断浏览器版本，以及哪些数据会进入分析存储。

## 结论

Browser Pulse **会判断 User-Agent**，但不会主动把完整 User-Agent 放入采集请求正文或分析存储：

- 在客户网站浏览器内读取 `navigator.userAgentData` 和必要时读取 `navigator.userAgent`；
- 优先使用低熵 User-Agent Client Hints（UA-CH）；
- UA-CH 不可用时，使用传统 User-Agent 正则匹配；
- 在浏览器端把结果归一化为浏览器家族、主版本、操作系统、设备类型和识别来源；
- 请求正文只发送归一化字段，不发送原始 User-Agent；
- 原始 User-Agent 只在页面内存中短暂读取，不写入 Browser Pulse 分析数据库。

实现位置：

- 识别与内联片段：[`src/lib/collector-snippet.ts`](../src/lib/collector-snippet.ts)
- 请求校验：[`src/routes/v1/browser-events/$collectorKey.ts`](../src/routes/v1/browser-events/$collectorKey.ts)
- 数据 schema：[`src/ingest/contract.ts`](../src/ingest/contract.ts)
- 队列消费与聚合：[`src/ingest/consumer.ts`](../src/ingest/consumer.ts)

## 采集流程

1. 控制台为项目生成带 `collectorKey` 的内联 `<script>`，不发布 npm 包，也不下载远程 SDK。
2. 接入方在自己的隐私告知或同意流程完成后，显式调用：

   ```js
   const result = await collectBrowserPulse()
   ```

3. 片段在当前页面内执行一次识别。重复调用会复用同一个 Promise，不会重复发送。
4. 浏览器向 `POST /v1/browser-events/{collectorKey}` 发送一条 `text/plain` JSON 请求，并自动携带当前页面的 `Origin`。
5. Worker 校验采集键、项目状态、Origin、请求体大小、Content-Type 和速率限制。
6. 校验通过后，服务端生成 `ingestId`、绑定 `projectId` 和接收时间，将消息发送到 Cloudflare Queue，并返回 `202`。
7. Queue Consumer 对消息做 schema 校验和幂等处理，同时写入原始事件和每日聚合。
8. 看板与“数据明细”页面读取每日聚合表；“数据明细”展示的是聚合行，不是原始请求记录。

```mermaid
flowchart LR
  A[客户网站同意流程] --> B[collectBrowserPulse()]
  B --> C[浏览器内 UA-CH / UA 识别]
  C --> D[归一化 JSON]
  D --> E[POST 采集 API]
  E --> F[Worker 校验 collectorKey / Origin / Schema]
  F --> G[Cloudflare Queue]
  G --> H[幂等消费]
  H --> I[(D1 daily_aggregates)]
  I --> J[看板与数据明细]
```

## 浏览器识别规则

### 1. 优先使用 UA-CH

片段首先读取：

```js
const data = navigator.userAgentData
```

如果存在 `data.brands`，按品牌名称匹配浏览器家族：

| 品牌匹配         | 归一化家族 |
| ---------------- | ---------- |
| `Microsoft Edge` | `Edge`     |
| `Google Chrome`  | `Chrome`   |
| `Chromium`       | `Chrome`   |
| `Opera`          | `Opera`    |

版本只保留主版本。例如 `140.0.7339.12` 只保留 `140`。

UA-CH 的 `brands` 可能包含 GREASE 或伪品牌，代码不会直接取数组第一项，而是逐项匹配已支持的品牌规则。

识别来源记录为：

```text
ua_ch
```

### 2. 回退到传统 User-Agent

当 `navigator.userAgentData` 不可用或没有匹配结果时，代码读取 `navigator.userAgent`，按以下规则匹配：

| 正则特征                           | 归一化家族         |
| ---------------------------------- | ------------------ |
| `SamsungBrowser/<major>`           | `Samsung Internet` |
| `Edg/`、`EdgA/`、`EdgiOS/`         | `Edge`             |
| `OPR/<major>`                      | `Opera`            |
| `CriOS/<major>`、`Chrome/<major>`  | `Chrome`           |
| `FxiOS/<major>`、`Firefox/<major>` | `Firefox`          |
| `Version/<major>...Safari/`        | `Safari`           |

识别来源记录为：

```text
user_agent_fallback
```

如果不能可靠识别，浏览器家族为 `Other` 或 `Unknown`，主版本为 `null`，不会猜测一个版本。

### 3. 操作系统判断

操作系统优先使用 `navigator.userAgentData.platform`。无法使用时，再匹配传统 UA：

| 来源特征                   | 操作系统   |
| -------------------------- | ---------- |
| `Windows NT`               | `Windows`  |
| `Macintosh` / `Mac OS X`   | `macOS`    |
| `iPhone` / `iPad` / `iPod` | `iOS`      |
| `Android`                  | `Android`  |
| `CrOS`                     | `ChromeOS` |
| `Linux`                    | `Linux`    |

触控 Mac 和 iPad 等场景会结合 `navigator.maxTouchPoints` 辅助判断，避免把平板误判为桌面设备。

### 4. 设备类型判断

- iPad、触控 Mac，或不含 `Mobile` 的 Android：`Tablet`
- `userAgentData.mobile` 为真，或 UA 命中手机特征：`Mobile`
- Windows、macOS、Linux、ChromeOS：`Desktop`
- 其他情况：`Other` 或 `Unknown`

## 请求正文

每个被接受的事件只包含以下字段：

```json
{
  "browserFamily": "Chrome",
  "browserMajor": "140",
  "osFamily": "Windows",
  "deviceClass": "Desktop",
  "detectionSource": "ua_ch",
  "snippetVersion": "1.0.0"
}
```

字段定义：

| 字段              | 说明                                                                     |
| ----------------- | ------------------------------------------------------------------------ |
| `browserFamily`   | Chrome、Edge、Firefox、Safari、Opera、Samsung Internet、Other 或 Unknown |
| `browserMajor`    | 十进制主版本字符串；无法可靠识别时为 `null`                              |
| `osFamily`        | Windows、macOS、iOS、Android、Linux、ChromeOS、Other 或 Unknown          |
| `deviceClass`     | Desktop、Mobile、Tablet、Other 或 Unknown                                |
| `detectionSource` | `ua_ch`、`user_agent_fallback` 或 `unknown`                              |
| `snippetVersion`  | 采集片段识别规则版本，目前为 `1.0.0`                                     |

schema 使用严格校验，未知字段会被拒绝。客户端不能在正文中指定 `projectId` 或 `workspaceId`；项目归属由服务端从 `collectorKey` 解析。

## 服务端校验与存储

采集 API 在入队前执行：

- `collectorKey` 签名和版本校验；
- 项目存在且状态为 `active`；
- `Origin` 与项目允许列表精确匹配；
- 请求正文不超过 1 KB；
- Content-Type 为 `text/plain` 或 `application/json`；
- 严格 JSON schema 校验；
- 按项目和采集键限流。

成功后返回 `202`。服务端额外生成：

- `projectId`：从采集键解析，不接受客户端覆盖；
- `ingestId`：服务端生成，用于队列幂等；
- `collectedAt`：服务端接收时间，UTC 存储。

Queue Consumer 首先以 `ingestId` 做 `INSERT OR IGNORE`，只有首次写入才增加 `daily_aggregates.event_count`。每日聚合按 UTC 自然日分桶；查询时由应用层按客户端当前时区换算筛选条件。

## 隐私边界

以下字段不会进入 Browser Pulse 的分析存储、队列死信正文或应用事件日志：

- 原始 User-Agent；
- 完整浏览器版本；
- IP 地址；
- 页面 URL、路径和 Referrer；
- Cookie、本地存储 ID 和跨站标识；
- 访客 ID、客户业务用户 ID；
- 语言、时区、屏幕尺寸、设备型号和架构。

需要区分两个层面：

1. **页面识别层**：代码会短暂读取 `navigator.userAgent`，仅用于归一化判断。
2. **网络传输层**：浏览器发起 HTTP 请求时，底层网络栈可能自动携带标准 `User-Agent` 请求头。采集 API 的应用代码不读取该请求头，也不把它写入数据库；Cloudflare 边缘层可能会短暂处理这类标准请求头。

因此，产品分析只依赖归一化后的浏览器环境字段，不能通过 Browser Pulse 数据还原某个网站访客或完整 User-Agent。

## 保留周期

- `raw_events`：保留 30 天，仅用于重聚合和数据质量修复，控制台不直接暴露原始事件；
- `daily_aggregates`：保留 13 个月，用于看板、趋势和数据明细；
- 每日 Cron 清理到期原始事件、聚合数据和过期认证记录。
