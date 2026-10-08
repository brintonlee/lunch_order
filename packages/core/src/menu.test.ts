import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createCore, CoreError, type Core } from "./index.js";

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");

function makeCore(): Core {
  return createCore({
    dbFile: ":memory:",
    migrationsFolder,
    adminDiscordIds: ["admin-1"],
    imageUrl: (p) => `/uploads/${p}`
  });
}

describe("MenuService", () => {
  let core: Core;
  beforeEach(() => {
    core = makeCore();
  });

  it("creates admin from ADMIN_DISCORD_IDS and member otherwise", () => {
    const admin = core.users.upsertFromDiscord({ discordId: "admin-1", displayName: "A", avatarUrl: null });
    const member = core.users.upsertFromDiscord({ discordId: "m-1", displayName: "M", avatarUrl: null });
    expect(admin.role).toBe("admin");
    expect(member.role).toBe("member");
  });

  it("replaces the whole menu for a same-named store (whitespace / width insensitive)", () => {
    const admin = core.users.upsertFromDiscord({ discordId: "admin-1", displayName: "A", avatarUrl: null });
    const first = core.menus.applyDraft(
      {
        storeName: "八方雲集",
        phone: "02-1111",
        address: "",
        note: "",
        items: [
          { name: "招牌鍋貼", price: 7, category: "鍋貼", isAvailable: true },
          { name: "酸辣湯", price: 35, category: "湯", isAvailable: true }
        ]
      },
      admin
    );
    expect(first.menuVersion).toBe(1);
    expect(first.items).toHaveLength(2);

    const second = core.menus.applyDraft(
      {
        storeName: "八方 雲集",
        phone: "",
        address: "",
        note: "",
        items: [{ name: "韭菜鍋貼", price: 8, category: "", isAvailable: true }]
      },
      admin
    );
    expect(second.id).toBe(first.id);
    expect(second.menuVersion).toBe(2);
    expect(second.phone).toBe("02-1111");
    expect(second.items.map((i) => i.name)).toEqual(["韭菜鍋貼"]);
    const listed = core.menus.listStores();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.itemCount).toBe(1);
  });

  it("forbids members from writing menus", () => {
    const member = core.users.upsertFromDiscord({ discordId: "m-1", displayName: "M", avatarUrl: null });
    expect(() => core.menus.createStore({ name: "X", phone: "", address: "", note: "" }, member)).toThrowError(CoreError);
  });

  it("approving a submission creates the store and marks it approved", () => {
    const admin = core.users.upsertFromDiscord({ discordId: "admin-1", displayName: "A", avatarUrl: null });
    const member = core.users.upsertFromDiscord({ discordId: "m-1", displayName: "M", avatarUrl: null });
    const sub = core.submissions.create(
      {
        source: "format",
        imagePaths: [],
        draft: { storeName: "小吃店", phone: "", address: "", note: "", items: [{ name: "滷肉飯", price: 40, category: "", isAvailable: true }] }
      },
      member
    );
    expect(core.submissions.list({ actor: member })).toHaveLength(1);
    const { storeId } = core.submissions.approve(sub.id, undefined, admin);
    expect(core.menus.getStore(storeId).items[0]?.name).toBe("滷肉飯");
    expect(core.submissions.get(sub.id, admin).status).toBe("approved");
    expect(() => core.submissions.approve(sub.id, undefined, admin)).toThrowError(/已審核/);
  });

  it("web sessions resolve to users and expire", () => {
    const u = core.users.upsertFromDiscord({ discordId: "m-1", displayName: "M", avatarUrl: null });
    const s = core.users.createSession(u.id);
    expect(core.users.getSessionUser(s.id)?.id).toBe(u.id);
    core.users.deleteSession(s.id);
    expect(core.users.getSessionUser(s.id)).toBeUndefined();
  });
});
