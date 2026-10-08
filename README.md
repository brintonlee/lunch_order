# 午餐團購系統 (lunch_order)

給 5–20 位熟人用的 Discord 訂午餐系統：Web 後台 + AI 菜單解析 + Discord Bot。
取代「一個人貼菜單、大家在 Discord 接龍」的流程。

## 架構

一個 Node.js (TypeScript) 進程同時跑 Fastify API、Discord Bot 與排程，資料存 SQLite。

```
apps/
  server/     Fastify API、靜態網頁、啟動 Discord Bot 與排程
  web/        React + Vite 後台（成員點餐頁亦在此）
packages/
  shared/     zod schema 與 API 型別（前後端共用）
  core/       Drizzle schema / migrations、MenuService、SubmissionService、UserService、事件
  ai/         菜單解析：Gemini / OpenAI 供應商抽象 + 純文字 / JSON 格式匯入
  discord/    discord.js 指令（/ping、/menu；開團 / 點餐於階段 02）
```

Discord Bot 與 HTTP API 都不直接碰資料庫，一律經過 `@lunch/core`。

## 開發

需要 Node.js 22 與 pnpm（`corepack enable`）。

```bash
pnpm install
cp .env.example .env        # 填 Discord / AI 設定；本機測試可設 DEV_LOGIN=1
pnpm dev                    # server :3000 + web :5173（proxy /api）
```

- `pnpm test`：Vitest（core 服務、格式解析）
- `pnpm typecheck` / `pnpm lint`
- `pnpm db:generate`：修改 `packages/core/src/db/schema.ts` 後產生 migration；啟動時自動套用

### 沒有 Discord App 時怎麼登入

`.env` 設 `DEV_LOGIN=1`，登入頁會多出「開發登入」，輸入任意 Discord ID 即可。
把該 ID 加進 `ADMIN_DISCORD_IDS` 就是 admin。**正式環境請勿開啟。**

### Discord 設定

1. https://discord.com/developers/applications 建立應用程式。
2. OAuth2 → Redirects 加上 `<PUBLIC_URL>/api/auth/discord/callback`；複製 Client ID / Secret。
3. Bot → Reset Token，複製為 `DISCORD_BOT_TOKEN`。
4. 用 OAuth2 URL Generator（scope: `bot` + `applications.commands`，權限：Send Messages、Embed Links、Manage Messages、Read Message History）邀請 Bot 進伺服器。
5. `DISCORD_GUILD_ID` 填伺服器 ID，斜線指令會立即生效。

### AI 菜單解析

`AI_PROVIDER=gemini`（預設，`gemini-2.5-flash`）或 `openai`（`gpt-4o-mini`），填入 `AI_API_KEY`。
不設定時網站仍可用「格式匯入」上架菜單，格式範本見匯入頁。

## 部署（自有機器 + Docker）

```bash
cp .env.example .env   # 填正式設定：PUBLIC_URL=https://你的網域、DEV_LOGIN=0
docker compose up -d --build
```

資料（SQLite 與菜單圖片）在 `./data`，請定期備份。前面接 Nginx / Caddy / Cloudflare Tunnel 做 HTTPS 即可。
