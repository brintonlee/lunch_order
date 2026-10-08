import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = () => Date.now();

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  discordId: text("discord_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  /** 餘額快取；真相在 ledger_entries */
  balance: integer("balance").notNull().default(0),
  createdAt: integer("created_at").notNull().$defaultFn(now)
});

export const webSessions = sqliteTable("web_sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull().$defaultFn(now)
});

export const stores = sqliteTable(
  "stores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    /** normalizeStoreName(name)，同名判定用 */
    nameKey: text("name_key").notNull(),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    note: text("note").notNull().default(""),
    menuVersion: integer("menu_version").notNull().default(0),
    menuUpdatedAt: integer("menu_updated_at"),
    status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: integer("created_at").notNull().$defaultFn(now)
  },
  (t) => [uniqueIndex("stores_name_key_idx").on(t.nameKey)]
);

export const menuItems = sqliteTable(
  "menu_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    category: text("category").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true)
  },
  (t) => [index("menu_items_store_idx").on(t.storeId)]
);

export const menuSubmissions = sqliteTable(
  "menu_submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    submittedBy: integer("submitted_by").notNull().references(() => users.id),
    storeNameHint: text("store_name_hint").notNull().default(""),
    source: text("source", { enum: ["ai", "format", "manual"] }).notNull().default("manual"),
    imagePathsJson: text("image_paths_json").notNull().default("[]"),
    aiResultJson: text("ai_result_json"),
    editedResultJson: text("edited_result_json").notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
    reviewedBy: integer("reviewed_by").references(() => users.id),
    reviewedAt: integer("reviewed_at"),
    rejectReason: text("reject_reason"),
    createdAt: integer("created_at").notNull().$defaultFn(now)
  },
  (t) => [index("menu_submissions_status_idx").on(t.status)]
);

export const orderSessions = sqliteTable(
  "order_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().references(() => stores.id),
    /** { name, phone } 快照 */
    storeSnapshotJson: text("store_snapshot_json").notNull(),
    status: text("status", { enum: ["open", "closed", "cancelled"] }).notNull().default("open"),
    openedBy: integer("opened_by").notNull().references(() => users.id),
    openedAt: integer("opened_at").notNull().$defaultFn(now),
    closedAt: integer("closed_at"),
    /** 結單後 7 天：此時間後清掉 order_lines */
    purgeAfter: integer("purge_after"),
    purgedAt: integer("purged_at"),
    guildId: text("guild_id"),
    channelId: text("channel_id"),
    menuMessageIdsJson: text("menu_message_ids_json").notNull().default("[]"),
    summaryMessageId: text("summary_message_id"),
    webToken: text("web_token").notNull().unique()
  },
  (t) => [index("order_sessions_status_idx").on(t.status), index("order_sessions_channel_idx").on(t.channelId)]
);

export const orderLines = sqliteTable(
  "order_lines",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id").notNull().references(() => orderSessions.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id),
    menuItemId: integer("menu_item_id"),
    itemName: text("item_name").notNull(),
    unitPrice: integer("unit_price").notNull(),
    qty: integer("qty").notNull().default(1),
    note: text("note").notNull().default(""),
    source: text("source", { enum: ["discord", "web"] }).notNull(),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    removedAt: integer("removed_at")
  },
  (t) => [index("order_lines_session_idx").on(t.sessionId), index("order_lines_user_idx").on(t.userId)]
);

export const ledgerEntries = sqliteTable(
  "ledger_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    /** 扣款為負、加值為正 */
    amount: integer("amount").notNull(),
    kind: text("kind", { enum: ["charge", "refund", "topup", "adjust"] }).notNull(),
    sessionId: integer("session_id"),
    orderLineId: integer("order_line_id"),
    memo: text("memo").notNull().default(""),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: integer("created_at").notNull().$defaultFn(now)
  },
  (t) => [index("ledger_entries_user_idx").on(t.userId)]
);

export type User = typeof users.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type MenuSubmission = typeof menuSubmissions.$inferSelect;
export type OrderSession = typeof orderSessions.$inferSelect;
export type OrderLine = typeof orderLines.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
