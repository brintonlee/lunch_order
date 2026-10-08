import { existsSync } from "node:fs";
import { join } from "node:path";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { MenuParser } from "@lunch/ai";
import { CoreError, type Core } from "@lunch/core";
import type { MeResponse } from "@lunch/shared";
import type { Config } from "./config.js";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { storeRoutes } from "./routes/stores.js";
import { submissionRoutes } from "./routes/submissions.js";
import { userRoutes } from "./routes/users.js";

export interface BuildAppOptions {
  config: Config;
  core: Core;
  parser: MenuParser | null;
  features: MeResponse["features"];
  logger?: boolean | object;
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const { config, core } = opts;
  const app = Fastify({ logger: opts.logger ?? true, trustProxy: true, bodyLimit: 2 * 1024 * 1024 });

  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, { limits: { fileSize: 15 * 1024 * 1024, files: 10 } });
  await app.register(authPlugin, { core });

  app.setErrorHandler((err: unknown, req, reply) => {
    if (err instanceof CoreError) return reply.code(err.httpStatus).send({ error: err.message, code: err.code });
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: err.issues.map((i) => `${i.path.join(".") || "body"}：${i.message}`).join("；"),
        code: "VALIDATION"
      });
    }
    const e = err as { statusCode?: number; message?: string };
    const status = e.statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    return reply.code(status).send({ error: status >= 500 ? "伺服器錯誤" : e.message ?? "錯誤", code: "ERROR" });
  });

  await app.register(
    async (api) => {
      api.get("/health", async () => ({ ok: true }));
      await api.register(authRoutes, { core, config, features: opts.features });
      await api.register(storeRoutes, { core });
      await api.register(submissionRoutes, { core, parser: opts.parser, uploadsDir: config.uploadsDir });
      await api.register(userRoutes, { core });
      api.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: "找不到此 API", code: "NOT_FOUND" }));
    },
    { prefix: "/api" }
  );

  // 上傳的菜單圖片：需登入才能看
  await app.register(fastifyStatic, {
    root: config.uploadsDir,
    prefix: "/uploads/",
    serve: false
  });
  app.get("/uploads/*", async (req, reply) => {
    if (!req.user) return reply.code(403).send({ error: "請先登入" });
    const rel = (req.params as { "*": string })["*"];
    if (rel.includes("..")) return reply.code(400).send();
    if (!existsSync(join(config.uploadsDir, rel))) return reply.code(404).send({ error: "找不到檔案" });
    return reply.sendFile(rel, config.uploadsDir);
  });

  // 前端 SPA（build 後才存在；dev 時由 Vite 提供）
  if (existsSync(config.webDistDir)) {
    await app.register(fastifyStatic, { root: config.webDistDir, prefix: "/", wildcard: false, decorateReply: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.method !== "GET" || req.url.startsWith("/api/")) return reply.code(404).send({ error: "Not found" });
      return reply.sendFile("index.html", config.webDistDir);
    });
  }

  return app;
}
