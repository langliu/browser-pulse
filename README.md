# Browser Pulse

用真实浏览器样本，决定浏览器支持线。

只采集最小匿名浏览器环境字段，为前端与 QA 团队提供浏览器主版本分布、趋势与最低支持线看板。不生成访客 ID、不保存原始 User-Agent、不设置第三方 Cookie。

## 功能

- **Google 登录**（Better Auth）：一个登录账号可管理多个工作区；Google OAuth 令牌不落库，会话只存 D1。
- **项目与接入**：工作区下创建多个项目，每个项目配置允许的 Origin；项目详情页提供公开写入专用 `collectorKey` 与内联接入代码。
- **内联采集片段**：无 npm 包、无远程 SDK，复制一段 `<script>` 并在站点同意流程后显式调用 `collectBrowserPulse()`；同一页面只发送一次。
- **看板**：浏览器版本分布（占比前 5 + 未知单列）、事件趋势（日/周/月）、最低支持版本策略配置与低于支持线占比实时重算；支持按操作系统、设备类型、时间范围筛选。
- **聚合存储**：事件按 UTC 自然日分桶写入每日聚合；看板按客户端当前时区计算筛选窗口；原始事件保留 30 天、每日聚合保留 13 个月。

## 技术栈

| 层     | 选型                                                  |
| ------ | ----------------------------------------------------- |
| 框架   | TanStack Start（React 19 + Server Functions）         |
| 运行时 | Cloudflare Workers（Vite 集成部署）                   |
| 数据   | Cloudflare D1 + Drizzle ORM（drizzle-kit 迁移）       |
| 队列   | Cloudflare Queues（采集解耦、幂等消费、死信队列）     |
| 认证   | Better Auth（Google social provider + D1 会话）       |
| UI     | shadcn/ui + Tailwind CSS 4（lucide 图标）             |
| 质量   | oxlint、oxfmt、lefthook（pre-commit / pre-push 钩子） |

## 快速开始

### 环境要求

- Node.js ≥ 20
- pnpm ≥ 9

### 安装与配置

```bash
pnpm install

# 配置环境变量（模板见 .env.example）
cp .env.example .env.local
# 编辑 .env.local 填入 BETTER_AUTH_URL、BETTER_AUTH_SECRET、KEY_PEPPER
# 以及 Google Cloud Console 创建的 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET

# 本地 D1 迁移
pnpm db:migrate:local
```

未配置 Google 凭据时应用仍可启动，首页会显示“Google 登录尚未配置”提示。

### 启动开发服务

```bash
pnpm dev
# http://localhost:3000
```

登录（或使用真实 Google 账号）后：创建工作区 → 创建项目并填写允许的 Origin（如 `http://localhost:3000`）→ 打开项目详情并从“接入代码”标签复制内联片段 → 在页面中调用 `collectBrowserPulse()`，队列消费成功后事件可见于项目看板。

## 常用脚本

| 命令                    | 说明                            |
| ----------------------- | ------------------------------- |
| `pnpm dev`              | 启动本地开发服务器（端口 3000） |
| `pnpm typecheck`        | TypeScript 类型检查             |
| `pnpm lint`             | oxlint 静态检查                 |
| `pnpm format`           | oxfmt 全量格式化                |
| `pnpm check`            | oxfmt 格式检查                  |
| `pnpm build`            | 生产构建（client + server）     |
| `pnpm db:generate`      | 根据 schema 生成 Drizzle 迁移   |
| `pnpm db:migrate:local` | 应用迁移到本地 D1               |
| `pnpm deploy`           | 构建并部署到 Cloudflare         |

提交代码时 lefthook 自动运行：pre-commit 检查变更文件 lint 与格式，pre-push 运行类型检查。

## 项目结构

```
src/
├── routes/                  # 页面与 API 路由
│   ├── index.tsx            # 首页（登录入口）
│   ├── app/                 # 控制台（工作区、项目列表、项目详情看板）
│   └── v1/browser-events/   # 采集 API
├── server/
│   └── dashboard.functions.ts  # Server Functions（工作区/项目/看板/策略）
├── lib/
│   ├── auth.ts              # Better Auth 配置
│   ├── keys.server.ts       # collectorKey 生成与校验
│   └── collector-snippet.ts # 内联采集片段生成
├── ingest/                  # 队列消费、幂等写入与每日聚合
├── db/                      # Drizzle schema
└── components/              # UI 组件与图表
```

## 采集与隐私边界

采集端点：`POST /v1/browser-events/{collectorKey}`，正文为 `text/plain` 的 JSON，最大 1 KB。响应：

| 状态  | 含义                      |
| ----- | ------------------------- |
| `202` | 校验通过，已入队          |
| `400` | 载荷无效                  |
| `401` | collectorKey 无效或已吊销 |
| `403` | Origin 不在项目白名单     |
| `413` | 正文超限                  |
| `429` | 速率限制                  |

每个事件仅保留：项目归属（服务端解析）、采集时间、浏览器家族与主版本、操作系统、设备类型、识别来源、片段版本。**禁止存储**：访客 ID、原始 User-Agent、IP、页面 URL、Cookie、跨站标识。事件无法关联到具体访客。

## 数据采集与 User-Agent 识别

Browser Pulse 会在客户网站浏览器内判断浏览器环境，但不会把完整 User-Agent 上传到分析存储：

- 优先读取低熵 `navigator.userAgentData`（UA-CH）；
- UA-CH 不可用时回退到 `navigator.userAgent` 正则匹配；
- 在浏览器端归一化为浏览器家族、主版本、操作系统、设备类型和识别来源；
- 请求正文只发送归一化字段，原始 User-Agent 只在页面内存中短暂读取；
- 浏览器底层 HTTP 请求可能自动携带标准 User-Agent 请求头，边缘层可能短暂处理，但应用代码不读取或存储该请求头。

采集只在接入方同意流程完成后显式调用 `collectBrowserPulse()`，每个页面最多发送一个事件。完整的识别规则、请求字段、服务端校验和隐私边界见[数据采集与 User-Agent 识别](docs/data-collection.md)。

## 部署

1. 创建生产 D1 数据库与 Queues（`browser-pulse-ingest` + 死信队列），将 `database_id` 写入 `wrangler.jsonc`。
2. 配置 Workers Secrets / Vars（同 `.env.example`，`BETTER_AUTH_URL` 为生产 HTTPS 域名）。
3. Google Cloud Console 登记回调：`https://<域名>/api/auth/callback/google`。
4. 应用远程迁移：`pnpm wrangler d1 migrations apply DB --remote`。
5. 部署：`pnpm deploy`。
