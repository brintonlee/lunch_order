import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default("0.0.0.0"),
  PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  DATA_DIR: z.string().default("./data"),
  MIGRATIONS_DIR: z.string().optional(),
  WEB_DIST_DIR: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().default(""),
  DISCORD_CLIENT_SECRET: z.string().default(""),
  DISCORD_BOT_TOKEN: z.string().default(""),
  DISCORD_GUILD_ID: z.string().default(""),
  ADMIN_DISCORD_IDS: z.string().default(""),
  AI_PROVIDER: z.enum(["gemini", "openai", "none"]).default("gemini"),
  AI_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default(""),
  AI_BASE_URL: z.string().default(""),
  DEV_LOGIN: z.string().default("0"),
  LOG_LEVEL: z.string().default("info")
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error("環境變數設定錯誤：" + parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  const e = parsed.data;
  const dataDir = path.resolve(e.DATA_DIR);
  const devLogin = e.DEV_LOGIN === "1" || e.DEV_LOGIN === "true";
  if (devLogin && e.NODE_ENV === "production") {
    // 允許，但在 log 大聲提醒（index.ts）
  }
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    host: e.HOST,
    publicUrl: e.PUBLIC_URL.replace(/\/$/, ""),
    dataDir,
    dbFile: path.join(dataDir, "lunch.db"),
    uploadsDir: path.join(dataDir, "uploads"),
    migrationsDir: e.MIGRATIONS_DIR ? path.resolve(e.MIGRATIONS_DIR) : path.resolve(process.cwd(), "packages/core/drizzle"),
    webDistDir: e.WEB_DIST_DIR ? path.resolve(e.WEB_DIST_DIR) : path.resolve(process.cwd(), "apps/web/dist"),
    discord: {
      clientId: e.DISCORD_CLIENT_ID,
      clientSecret: e.DISCORD_CLIENT_SECRET,
      botToken: e.DISCORD_BOT_TOKEN,
      guildId: e.DISCORD_GUILD_ID || undefined
    },
    adminDiscordIds: e.ADMIN_DISCORD_IDS.split(",").map((s) => s.trim()).filter(Boolean),
    ai: { provider: e.AI_PROVIDER, apiKey: e.AI_API_KEY || undefined, model: e.AI_MODEL || undefined, baseUrl: e.AI_BASE_URL || undefined },
    devLogin,
    logLevel: e.LOG_LEVEL
  };
}
