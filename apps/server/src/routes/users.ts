import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { toUserDto, type Core } from "@lunch/core";
import { updateUserBodySchema } from "@lunch/shared";
import { requireAdmin } from "../plugins/auth.js";

export const userRoutes: FastifyPluginAsync<{ core: Core }> = async (app, { core }) => {
  app.get("/users", async (req, reply) => {
    requireAdmin(req, reply);
    return core.users.list().map(toUserDto);
  });

  app.patch("/users/:id", async (req, reply) => {
    const actor = requireAdmin(req, reply);
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const body = updateUserBodySchema.parse(req.body);
    return toUserDto(core.users.setRole(id, body.role, actor));
  });
};
