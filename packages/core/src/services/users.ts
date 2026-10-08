import { randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { UserDto, UserRole } from "@lunch/shared";
import type { Db } from "../db/index.js";
import { users, webSessions, type User } from "../db/schema.js";
import { CoreError } from "../errors.js";

export interface DiscordProfile {
  discordId: string;
  displayName: string;
  avatarUrl: string | null;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function toUserDto(u: User): UserDto {
  return {
    id: u.id,
    discordId: u.discordId,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    role: u.role,
    balance: u.balance,
    createdAt: u.createdAt
  };
}

export class UserService {
  constructor(
    private db: Db,
    private adminDiscordIds: Set<string>
  ) {}

  /** 第一次登入 / 下指令時自動建立；之後同步名稱與頭像 */
  upsertFromDiscord(profile: DiscordProfile): User {
    const existing = this.db.select().from(users).where(eq(users.discordId, profile.discordId)).get();
    const shouldBeAdmin = this.adminDiscordIds.has(profile.discordId);
    if (existing) {
      const role: UserRole = shouldBeAdmin ? "admin" : existing.role;
      return this.db
        .update(users)
        .set({ displayName: profile.displayName, avatarUrl: profile.avatarUrl, role })
        .where(eq(users.id, existing.id))
        .returning()
        .get()!;
    }
    return this.db
      .insert(users)
      .values({
        discordId: profile.discordId,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        role: shouldBeAdmin ? "admin" : "member"
      })
      .returning()
      .get()!;
  }

  getById(id: number): User | undefined {
    return this.db.select().from(users).where(eq(users.id, id)).get();
  }

  getByDiscordId(discordId: string): User | undefined {
    return this.db.select().from(users).where(eq(users.discordId, discordId)).get();
  }

  list(): User[] {
    return this.db.select().from(users).orderBy(users.displayName).all();
  }

  setRole(userId: number, role: UserRole, actor: User): User {
    if (actor.role !== "admin") throw new CoreError("FORBIDDEN", "只有 admin 可以調整角色");
    if (actor.id === userId && role !== "admin") throw new CoreError("INVALID", "不能把自己降為成員");
    const updated = this.db.update(users).set({ role }).where(eq(users.id, userId)).returning().get();
    if (!updated) throw new CoreError("NOT_FOUND", "找不到使用者");
    return updated;
  }

  // ---- Web sessions ----

  createSession(userId: number): { id: string; expiresAt: number } {
    const id = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + SESSION_TTL_MS;
    this.db.insert(webSessions).values({ id, userId, expiresAt }).run();
    return { id, expiresAt };
  }

  getSessionUser(sessionId: string): User | undefined {
    const row = this.db
      .select({ user: users, expiresAt: webSessions.expiresAt })
      .from(webSessions)
      .innerJoin(users, eq(users.id, webSessions.userId))
      .where(eq(webSessions.id, sessionId))
      .get();
    if (!row) return undefined;
    if (row.expiresAt < Date.now()) {
      this.deleteSession(sessionId);
      return undefined;
    }
    return row.user;
  }

  deleteSession(sessionId: string): void {
    this.db.delete(webSessions).where(eq(webSessions.id, sessionId)).run();
  }

  purgeExpiredSessions(): number {
    return this.db.delete(webSessions).where(lt(webSessions.expiresAt, Date.now())).run().changes;
  }
}
