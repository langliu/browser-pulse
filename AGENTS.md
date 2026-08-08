# AGENTS.md

本文件为在此仓库工作的 AI 编码代理提供约定与约束。开始任何任务前先阅读本文件与 `.env.example`。

## 项目概览

Browser Pulse：浏览器版本分布分析 SaaS。TanStack Start（React 19 + Server Functions）运行在 Cloudflare Workers 上，数据存 Cloudflare D1，采集经 Queues 异步消费。Google 登录（Better Auth），单账号单工作区模型。

## 常用命令

```bash
pnpm dev                 # 本地开发（端口 3000，读取 .env.local 作为 bindings 配置）
pnpm typecheck           # tsc --noEmit
pnpm lint                # oxlint
pnpm format              # oxfmt 全量格式化（写入）
pnpm check               # oxfmt --check .（CI/钩子使用）
pnpm build               # 生产构建（vite build，产出 dist/）
pnpm db:generate         # drizzle-kit generate（改 schema 后运行）
pnpm db:migrate:local    # 应用迁移到本地 D1
pnpm deploy              # 构建 + wrangler deploy
```

代码质量工具是 **oxlint / oxfmt / lefthook**。**不要运行 `prettier`、`eslint` 或相关 npm 脚本**——仓库中已不存在。

- pre-commit（lefthook）：变更文件 `oxlint` + `oxfmt --check`
- pre-push：`pnpm typecheck`

## 架构要点

- **Server Functions**：`src/server/dashboard.functions.ts` 承载控制台所有数据操作（`createServerFn` + zod `validator`）。浏览器端直接 import 调用，不要另建 REST 路由。
- **服务端环境变量**：通过 `import { env } from 'cloudflare:workers'` 读取（`src/lib/auth.ts`、`src/lib/keys.server.ts` 等）。完整清单见 `.env.example`。
- **采集 API**：`src/routes/v1/browser-events/$collectorKey.ts`，POST + 签名 collectorKey + Origin 白名单校验，成功返回 `202` 并入队。
- **队列消费**：`src/ingest/consumer.ts`，按 `ingestId` 幂等写入 `raw_events` 并累计 `daily_aggregates`（UTC `utc_date` 分桶）。
- **路由约定**：文件式路由（`src/routes/`）；API 路由用 `server.handlers`，受保护页面用 loader + `requireSessionUser()`。

## 必须遵守的产品合同

### 隐私边界（不可破坏）

- 事件表（`raw_events` / `daily_aggregates`）**禁止**出现：访客 ID、原始 User-Agent、IP、页面 URL、Referrer、Cookie、跨站标识。`visitorId` 概念不存在。
- `src/lib/auth.ts` 的 `databaseHooks` 必须保持：OAuth access/refresh/id token 置空；会话 `ipAddress`、`userAgent` 置空。新增写入路径不得绕过。
- 采集请求正文只有 `browserFamily / browserMajor / osFamily / deviceClass / detectionSource / snippetVersion`，且 schema 必须 `.strict()`（未知字段拒绝）。

### 密钥体系

- `collectorKey`：公开、写入专用（示例 `bpc_live_...`），HMAC 签名由 `KEY_PEPPER` 生成（`src/lib/keys.server.ts`）。可出现在客户网页中，无读取权限。轮换时旧键**立即吊销**。
- MVP **不提供** `queryApiKey` / 对外聚合 HTTP API；聚合仅经登录会话 + Server Functions。
- `KEY_PEPPER` 变更会使存量采集键全部失效；`BETTER_AUTH_SECRET` 变更会使存量会话失效。

### 业务规则

- **多工作区**：一个 Google 账号可拥有多个工作区（默认上限 20）；控制台支持切换；工作区之间数据完全隔离。
- 工作区删除需名称确认，级联删除其下项目、Origin、采集键、策略、原始事件与聚合；删除当前工作区后应切到仍存在的工作区或空状态。
- 每个工作区最多 50 个项目；项目可停用、删除（名称确认）与轮换 `collectorKey`（旧键立即吊销）。
- Origin 白名单精确匹配（scheme + host + port），仅 HTTPS（localhost 例外），创建时校验并去重。
- 聚合按 UTC 自然日存储；查询时按客户端当前时区计算筛选与展示窗口；`raw_events` 保留 30 天，`daily_aggregates` 保留 13 个月（`src/ingest/consumer.ts` 的 Cron 清理）。
- `raw_events` 可供**所有者**在控制台查看有限「最近事件」调试列表；禁止对外逐事件 API 与批量导出；界面不得称为访客/用户列表。
- 看板语义：`belowSupportRate = belowSupportEvents / policyEligibleEvents`，**分母为 0 时必须返回 `null`（不是 0）**；分布仅展示占比前 5；策略修改只重算不改写历史事件。
- 支持策略表 `support_policies` 主键为 `(projectId, browserFamily)`。
- 暂不提供成员邀请、跨账号共享工作区或角色体系；工作区仅归属 `ownerUserId`。
- 产品合同以 `PRODUCT_DEFINITION.md`（当前 1.1）为准；实现与文档冲突时先改文档或实现之一，禁止长期双轨。

## 易错点

- 生成文件不要手改：`src/routeTree.gen.ts`（tsr generate）、`worker-configuration.d.ts`（wrangler types）、`drizzle/meta/`。
- `.env.local`、`.dev.vars` 类文件禁止提交；新增密钥类环境变量时同步更新 `.env.example`。
- 修改被导出的服务函数/类型前，先 `lsp references` 查调用方（页面 loader、组件、其他服务函数）。
- 服务端代码中 `new Date().toISOString()` 传往客户端前需要序列化；Date 对象只在服务端内部使用。
- 队列消息 schema 用 zod 严格校验，坏消息直接 `ack` 而非 `retry`（防死信循环）；只有落库失败才 `retry`。
- 依赖 Better Auth 的行为（会话、OAuth）通过 `getAuth().api.*` 调用，不要绕过 D1 手写会话校验。
