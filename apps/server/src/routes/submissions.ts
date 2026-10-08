import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { MENU_TEXT_TEMPLATE, MenuParseError, parseMenuText, type MenuImage, type MenuParser } from "@lunch/ai";
import { CoreError, type Core } from "@lunch/core";
import {
  createSubmissionBodySchema,
  formatImportBodySchema,
  menuDraftSchema,
  rejectSubmissionBodySchema,
  reviewSubmissionBodySchema
} from "@lunch/shared";
import { requireAdmin, requireUser } from "../plugins/auth.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export interface SubmissionRouteOptions {
  core: Core;
  parser: MenuParser | null;
  uploadsDir: string;
}

export const submissionRoutes: FastifyPluginAsync<SubmissionRouteOptions> = async (app, { core, parser, uploadsDir }) => {
  /** 上傳 1–N 張照片 → 存檔 → AI 解析 → 回傳草稿（尚未建立投稿） */
  app.post("/menu-submissions/parse", async (req, reply) => {
    requireUser(req, reply);
    if (!parser) throw new CoreError("INVALID", "尚未設定 AI 供應商（AI_PROVIDER / AI_API_KEY），請改用格式匯入");

    const images: MenuImage[] = [];
    const savedPaths: string[] = [];
    let storeNameHint = "";
    const day = new Date().toISOString().slice(0, 10);
    await mkdir(path.join(uploadsDir, day), { recursive: true });

    for await (const part of req.parts()) {
      if (part.type === "file") {
        if (!ALLOWED_MIME.has(part.mimetype)) throw new CoreError("INVALID", `不支援的圖片格式：${part.mimetype}`);
        const data = await part.toBuffer();
        if (data.length === 0) continue;
        const ext = part.mimetype.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
        const rel = `${day}/${randomBytes(8).toString("hex")}.${ext}`;
        await writeFile(path.join(uploadsDir, rel), data);
        savedPaths.push(rel);
        images.push({ mimeType: part.mimetype, data });
      } else if (part.fieldname === "storeNameHint") {
        storeNameHint = String(part.value ?? "").trim();
      }
    }
    if (images.length === 0) throw new CoreError("INVALID", "請至少上傳一張菜單照片");

    try {
      const draft = await parser.parseMenuImages(images, { storeNameHint: storeNameHint || undefined });
      return { draft, imagePaths: savedPaths, provider: parser.name };
    } catch (err) {
      if (err instanceof MenuParseError) throw new CoreError("INVALID", err.message);
      throw err;
    }
  });

  /** 純文字 / JSON 格式 → 草稿（不經 AI） */
  app.post("/menu-submissions/parse-text", async (req, reply) => {
    requireUser(req, reply);
    const body = formatImportBodySchema.parse(req.body);
    try {
      return { draft: parseMenuText(body.text) };
    } catch (err) {
      if (err instanceof MenuParseError) throw new CoreError("INVALID", err.message);
      throw err;
    }
  });

  app.get("/menu-submissions/template", async () => ({ text: MENU_TEXT_TEMPLATE }));

  app.post("/menu-submissions", async (req, reply) => {
    const actor = requireUser(req, reply);
    const body = createSubmissionBodySchema.parse(req.body);
    return reply.code(201).send(core.submissions.create(body, actor));
  });

  app.get("/menu-submissions", async (req, reply) => {
    const actor = requireUser(req, reply);
    const q = z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }).parse(req.query);
    return core.submissions.list({ status: q.status, actor });
  });

  app.get("/menu-submissions/:id", async (req, reply) => {
    const actor = requireUser(req, reply);
    return core.submissions.get(idParam.parse(req.params).id, actor);
  });

  app.put("/menu-submissions/:id", async (req, reply) => {
    const actor = requireUser(req, reply);
    const draft = menuDraftSchema.parse((req.body as { draft?: unknown })?.draft ?? req.body);
    return core.submissions.updateDraft(idParam.parse(req.params).id, draft, actor);
  });

  app.post("/menu-submissions/:id/approve", async (req, reply) => {
    const actor = requireAdmin(req, reply);
    const body = reviewSubmissionBodySchema.parse(req.body ?? {});
    return core.submissions.approve(idParam.parse(req.params).id, body.draft, actor);
  });

  app.post("/menu-submissions/:id/reject", async (req, reply) => {
    const actor = requireAdmin(req, reply);
    const body = rejectSubmissionBodySchema.parse(req.body ?? {});
    return core.submissions.reject(idParam.parse(req.params).id, body.reason, actor);
  });

  /** admin 直接以草稿上架（同名取代） */
  app.post("/menus/apply", async (req, reply) => {
    const actor = requireAdmin(req, reply);
    const draft = menuDraftSchema.parse((req.body as { draft?: unknown })?.draft ?? req.body);
    return core.menus.applyDraft(draft, actor);
  });
};
