import { mkdirSync } from "node:fs";
import cron from "node-cron";
import { createMenuParser } from "@lunch/ai";
import { createCore } from "@lunch/core";
import { createDiscordBot } from "@lunch/discord";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

async function main() {
  const config = loadConfig();
  mkdirSync(config.uploadsDir, { recursive: true });

  const core = createCore({
    dbFile: config.dbFile,
    migrationsFolder: config.migrationsDir,
    adminDiscordIds: config.adminDiscordIds,
    imageUrl: (p) => `/uploads/${p}`
  });

  const parser = createMenuParser(config.ai);
  const botEnabled = Boolean(config.discord.botToken && config.discord.clientId);

  const app = await buildApp({
    config,
    core,
    parser,
    features: { devLogin: config.devLogin, aiProvider: parser?.name ?? "none", discordBot: botEnabled },
    logger:
      config.nodeEnv === "development"
        ? { level: config.logLevel, transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } } }
        : { level: config.logLevel }
  });

  if (config.devLogin) app.log.warn("DEV_LOGIN 已開啟：任何人都能用 POST /api/auth/dev 登入，正式環境請關閉");
  if (!parser) app.log.warn(`AI 解析未啟用（provider=${config.ai.provider}, key=${config.ai.apiKey ? "set" : "missing"}），僅能用格式匯入`);
  if (config.adminDiscordIds.length === 0) app.log.warn("ADMIN_DISCORD_IDS 為空：沒有人會是 admin");

  const bot = botEnabled
    ? createDiscordBot(
        { token: config.discord.botToken, clientId: config.discord.clientId, guildId: config.discord.guildId },
        { core, publicUrl: config.publicUrl, log: { info: (m, ...a) => app.log.info(a.length ? { a } : {}, m), error: (m, ...a) => app.log.error({ a }, m) } }
      )
    : null;

  // 每小時：清過期 web session（7 天訂單清理於階段 03 加入）
  cron.schedule("0 * * * *", () => {
    const n = core.users.purgeExpiredSessions();
    if (n) app.log.info(`purged ${n} expired web sessions`);
  });

  await app.listen({ port: config.port, host: config.host });
  if (bot) {
    bot.start().catch((err) => app.log.error(err, "Discord bot failed to start"));
  } else {
    app.log.warn("Discord Bot 未啟動（缺 DISCORD_BOT_TOKEN 或 DISCORD_CLIENT_ID）");
  }

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down`);
    await bot?.stop().catch(() => {});
    await app.close();
    core.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
