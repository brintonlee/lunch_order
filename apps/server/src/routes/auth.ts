import { randomBytes } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { toUserDto, type Core } from "@lunch/core";
import type { MeResponse } from "@lunch/shared";
import type { Config } from "../config.js";
import { SESSION_COOKIE } from "../plugins/auth.js";

const STATE_COOKIE = "lunch_oauth_state";
const DISCORD_API = "https://discord.com/api/v10";

export interface AuthRouteOptions {
  core: Core;
  config: Config;
  features: MeResponse["features"];
}

export const authRoutes: FastifyPluginAsync<AuthRouteOptions> = async (app, { core, config, features }) => {
  const redirectUri = `${config.publicUrl}/api/auth/discord/callback`;
  const secure = config.publicUrl.startsWith("https://");

  app.get("/me", async (req): Promise<MeResponse> => ({ user: req.user ? toUserDto(req.user) : null, features }));

  app.get("/auth/discord", async (req, reply) => {
    if (!config.discord.clientId) return reply.code(503).send({ error: "尚未設定 DISCORD_CLIENT_ID" });
    const state = randomBytes(16).toString("hex");
    const url = new URL(`${DISCORD_API}/oauth2/authorize`);
    url.searchParams.set("client_id", config.discord.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "identify");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "none");
    reply.setCookie(STATE_COOKIE, state, { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: 600 });
    return reply.redirect(url.toString());
  });

  app.get("/auth/discord/callback", async (req, reply) => {
    const q = z.object({ code: z.string(), state: z.string() }).safeParse(req.query);
    if (!q.success || q.data.state !== req.cookies[STATE_COOKIE]) {
      return reply.code(400).send({ error: "OAuth state 不符，請重新登入" });
    }
    reply.clearCookie(STATE_COOKIE, { path: "/" });

    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: "authorization_code",
        code: q.data.code,
        redirect_uri: redirectUri
      })
    });
    if (!tokenRes.ok) {
      app.log.error({ status: tokenRes.status, body: await tokenRes.text() }, "discord token exchange failed");
      return reply.code(502).send({ error: "Discord 登入失敗（token）" });
    }
    const token = (await tokenRes.json()) as { access_token: string };
    const meRes = await fetch(`${DISCORD_API}/users/@me`, { headers: { authorization: `Bearer ${token.access_token}` } });
    if (!meRes.ok) return reply.code(502).send({ error: "Discord 登入失敗（profile）" });
    const me = (await meRes.json()) as { id: string; username: string; global_name: string | null; avatar: string | null };

    const user = core.users.upsertFromDiscord({
      discordId: me.id,
      displayName: me.global_name ?? me.username,
      avatarUrl: me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128` : null
    });
    const session = core.users.createSession(user.id);
    reply.setCookie(SESSION_COOKIE, session.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure,
      expires: new Date(session.expiresAt)
    });
    return reply.redirect("/");
  });

  app.post("/logout", async (req, reply) => {
    const sid = req.cookies[SESSION_COOKIE];
    if (sid) core.users.deleteSession(sid);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  if (config.devLogin) {
    // 開發 / 測試用：不經 Discord 直接登入
    app.post("/auth/dev", async (req, reply) => {
      const body = z
        .object({ discordId: z.string().min(1).max(32), displayName: z.string().min(1).max(32).default("測試用戶") })
        .parse(req.body);
      const user = core.users.upsertFromDiscord({ discordId: body.discordId, displayName: body.displayName, avatarUrl: null });
      const session = core.users.createSession(user.id);
      reply.setCookie(SESSION_COOKIE, session.id, { path: "/", httpOnly: true, sameSite: "lax", secure, expires: new Date(session.expiresAt) });
      return { user: toUserDto(user) };
    });
  }
};
