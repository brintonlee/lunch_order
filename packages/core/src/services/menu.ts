import { and, asc, eq, like, sql } from "drizzle-orm";
import {
  normalizeStoreName,
  type MenuDraft,
  type MenuItemDto,
  type StoreDetailDto,
  type StoreDto,
  type UpsertStoreBody
} from "@lunch/shared";
import type { Db } from "../db/index.js";
import { menuItems, stores, type MenuItem, type Store, type User } from "../db/schema.js";
import { CoreError } from "../errors.js";
import type { CoreEventBus } from "../events.js";

export function toMenuItemDto(i: MenuItem): MenuItemDto {
  return {
    id: i.id,
    storeId: i.storeId,
    name: i.name,
    price: i.price,
    category: i.category,
    sortOrder: i.sortOrder,
    isAvailable: i.isAvailable
  };
}

function assertAdmin(actor: User): void {
  if (actor.role !== "admin") throw new CoreError("FORBIDDEN", "只有 admin 可以執行此操作");
}

export class MenuService {
  constructor(
    private db: Db,
    private events: CoreEventBus
  ) {}

  listStores(opts: { includeArchived?: boolean } = {}): StoreDto[] {
    const rows = this.db
      .select()
      .from(stores)
      .where(opts.includeArchived ? undefined : eq(stores.status, "active"))
      .orderBy(asc(stores.name))
      .all();
    const counts = new Map(
      this.db
        .select({ storeId: menuItems.storeId, n: sql<number>`count(*)`.mapWith(Number) })
        .from(menuItems)
        .groupBy(menuItems.storeId)
        .all()
        .map((r) => [r.storeId, r.n])
    );
    return rows.map((s) => this.toStoreDto(s, counts.get(s.id) ?? 0));
  }

  getStore(id: number): StoreDetailDto {
    const store = this.db.select().from(stores).where(eq(stores.id, id)).get();
    if (!store) throw new CoreError("NOT_FOUND", "找不到店家");
    const items = this.listItems(id);
    return { ...this.toStoreDto(store, items.length), items: items.map(toMenuItemDto) };
  }

  findStoreByName(name: string): Store | undefined {
    return this.db.select().from(stores).where(eq(stores.nameKey, normalizeStoreName(name))).get();
  }

  listItems(storeId: number): MenuItem[] {
    return this.db
      .select()
      .from(menuItems)
      .where(eq(menuItems.storeId, storeId))
      .orderBy(asc(menuItems.sortOrder), asc(menuItems.id))
      .all();
  }

  /** Discord autocomplete 用：依名稱前綴 / 包含比對 */
  searchItems(storeId: number, query: string, limit = 25): MenuItem[] {
    const q = query.trim();
    const where = q
      ? and(eq(menuItems.storeId, storeId), eq(menuItems.isAvailable, true), like(menuItems.name, `%${q}%`))
      : and(eq(menuItems.storeId, storeId), eq(menuItems.isAvailable, true));
    return this.db.select().from(menuItems).where(where).orderBy(asc(menuItems.sortOrder)).limit(limit).all();
  }

  searchStores(query: string, limit = 25): Store[] {
    const q = query.trim();
    const where = q ? and(eq(stores.status, "active"), like(stores.name, `%${q}%`)) : eq(stores.status, "active");
    return this.db.select().from(stores).where(where).orderBy(asc(stores.name)).limit(limit).all();
  }

  createStore(body: UpsertStoreBody, actor: User): Store {
    assertAdmin(actor);
    const nameKey = normalizeStoreName(body.name);
    if (this.db.select({ id: stores.id }).from(stores).where(eq(stores.nameKey, nameKey)).get()) {
      throw new CoreError("CONFLICT", `店家「${body.name}」已存在`);
    }
    return this.db
      .insert(stores)
      .values({ ...body, nameKey, createdBy: actor.id })
      .returning()
      .get()!;
  }

  updateStore(id: number, body: Partial<UpsertStoreBody> & { status?: "active" | "archived" }, actor: User): Store {
    assertAdmin(actor);
    const existing = this.db.select().from(stores).where(eq(stores.id, id)).get();
    if (!existing) throw new CoreError("NOT_FOUND", "找不到店家");
    const patch: Partial<typeof stores.$inferInsert> = { ...body };
    if (body.name !== undefined) {
      const nameKey = normalizeStoreName(body.name);
      const dup = this.db.select({ id: stores.id }).from(stores).where(eq(stores.nameKey, nameKey)).get();
      if (dup && dup.id !== id) throw new CoreError("CONFLICT", `店家「${body.name}」已存在`);
      patch.nameKey = nameKey;
    }
    return this.db.update(stores).set(patch).where(eq(stores.id, id)).returning().get()!;
  }

  deleteStore(id: number, actor: User): void {
    assertAdmin(actor);
    const res = this.db.delete(stores).where(eq(stores.id, id)).run();
    if (res.changes === 0) throw new CoreError("NOT_FOUND", "找不到店家");
  }

  /**
   * 整份取代某店家的菜單：同一 transaction 內刪掉舊品項、寫入新品項、menu_version + 1。
   * 已存在的訂單行持有名稱 / 價格快照，不受影響。
   */
  replaceMenu(storeId: number, items: MenuDraft["items"], actor: User): StoreDetailDto {
    assertAdmin(actor);
    const result = this.db.transaction((tx) => {
      const store = tx.select().from(stores).where(eq(stores.id, storeId)).get();
      if (!store) throw new CoreError("NOT_FOUND", "找不到店家");
      tx.delete(menuItems).where(eq(menuItems.storeId, storeId)).run();
      if (items.length > 0) {
        tx.insert(menuItems)
          .values(
            items.map((it, idx) => ({
              storeId,
              name: it.name,
              price: it.price,
              category: it.category ?? "",
              isAvailable: it.isAvailable ?? true,
              sortOrder: idx
            }))
          )
          .run();
      }
      return tx
        .update(stores)
        .set({ menuVersion: store.menuVersion + 1, menuUpdatedAt: Date.now() })
        .where(eq(stores.id, storeId))
        .returning()
        .get()!;
    });
    this.events.emit("menu.replaced", { storeId, storeName: result.name, menuVersion: result.menuVersion });
    return this.getStore(storeId);
  }

  /**
   * 以一份草稿「上架」：店名相同（normalize 後）則整份取代，否則新建店家。
   * 店家資訊（電話 / 地址 / 備註）以草稿為準，草稿留空則保留舊值。
   */
  applyDraft(draft: MenuDraft, actor: User): StoreDetailDto {
    assertAdmin(actor);
    const storeId = this.db.transaction((tx) => {
      const nameKey = normalizeStoreName(draft.storeName);
      const existing = tx.select().from(stores).where(eq(stores.nameKey, nameKey)).get();
      if (existing) {
        tx.update(stores)
          .set({
            name: draft.storeName,
            phone: draft.phone || existing.phone,
            address: draft.address || existing.address,
            note: draft.note || existing.note,
            status: "active"
          })
          .where(eq(stores.id, existing.id))
          .run();
        return existing.id;
      }
      return tx
        .insert(stores)
        .values({
          name: draft.storeName,
          nameKey,
          phone: draft.phone ?? "",
          address: draft.address ?? "",
          note: draft.note ?? "",
          createdBy: actor.id
        })
        .returning({ id: stores.id })
        .get()!.id;
    });
    return this.replaceMenu(storeId, draft.items, actor);
  }

  setItemAvailability(itemId: number, isAvailable: boolean, actor: User): MenuItem {
    assertAdmin(actor);
    const row = this.db.update(menuItems).set({ isAvailable }).where(eq(menuItems.id, itemId)).returning().get();
    if (!row) throw new CoreError("NOT_FOUND", "找不到品項");
    return row;
  }

  private toStoreDto(s: Store, itemCount: number): StoreDto {
    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      address: s.address,
      note: s.note,
      menuVersion: s.menuVersion,
      menuUpdatedAt: s.menuUpdatedAt,
      status: s.status,
      itemCount
    };
  }
}
