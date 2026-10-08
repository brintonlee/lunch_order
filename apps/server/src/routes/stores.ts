import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Core } from "@lunch/core";
import { replaceMenuBodySchema, upsertStoreBodySchema } from "@lunch/shared";
import { requireAdmin, requireUser } from "../plugins/auth.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });

export const storeRoutes: FastifyPluginAsync<{ core: Core }> = async (app, { core }) => {
  app.get("/stores", async (req) => {
    requireUser(req, app as never);
    const q = z.object({ includeArchived: z.enum(["true", "false", "1", "0"]).optional() }).parse(req.query);
    const includeArchived = q.includeArchived === "true" || q.includeArchived === "1";
    return core.menus.listStores({ includeArchived: includeArchived && req.user?.role === "admin" });
  });

  app.get("/stores/:id", async (req) => {
    requireUser(req, app as never);
    return core.menus.getStore(idParam.parse(req.params).id);
  });

  app.post("/stores", async (req, reply) => {
    const actor = requireAdmin(req, reply);
    const store = core.menus.createStore(upsertStoreBodySchema.parse(req.body), actor);
    return reply.code(201).send(core.menus.getStore(store.id));
  });

  app.put("/stores/:id", async (req, reply) => {
    const actor = requireAdmin(req, reply);
    const body = upsertStoreBodySchema.partial().extend({ status: z.enum(["active", "archived"]).optional() }).parse(req.body);
    const store = core.menus.updateStore(idParam.parse(req.params).id, body, actor);
    return core.menus.getStore(store.id);
  });

  app.put("/stores/:id/menu", async (req, reply) => {
    const actor = requireAdmin(req, reply);
    return core.menus.replaceMenu(idParam.parse(req.params).id, replaceMenuBodySchema.parse(req.body).items, actor);
  });

  app.delete("/stores/:id", async (req, reply) => {
    const actor = requireAdmin(req, reply);
    core.menus.deleteStore(idParam.parse(req.params).id, actor);
    return reply.code(204).send();
  });

  app.patch("/menu-items/:id", async (req, reply) => {
    const actor = requireAdmin(req, reply);
    const body = z.object({ isAvailable: z.boolean() }).parse(req.body);
    return core.menus.setItemAvailability(idParam.parse(req.params).id, body.isAvailable, actor);
  });
};
