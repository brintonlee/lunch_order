import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { Core, User } from "@lunch/core";
import { CoreError } from "@lunch/core";

export const SESSION_COOKIE = "lunch_sid";

declare module "fastify" {
  interface FastifyRequest {
    user: User | null;
  }
}

export const authPlugin = fp<{ core: Core }>(async (app, opts) => {
  app.decorateRequest("user", null);
  app.addHook("onRequest", async (req) => {
    const sid = req.cookies[SESSION_COOKIE];
    req.user = sid ? (opts.core.users.getSessionUser(sid) ?? null) : null;
  });
});

export function requireUser(req: FastifyRequest, _reply: FastifyReply): User {
  if (!req.user) throw new CoreError("FORBIDDEN", "請先登入");
  return req.user;
}

export function requireAdmin(req: FastifyRequest, reply: FastifyReply): User {
  const u = requireUser(req, reply);
  if (u.role !== "admin") throw new CoreError("FORBIDDEN", "需要 admin 權限");
  return u;
}
