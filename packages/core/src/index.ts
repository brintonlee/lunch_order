import { openDb, type Db } from "./db/index.js";
import { CoreEventBus } from "./events.js";
import { MenuService } from "./services/menu.js";
import { SubmissionService } from "./services/submissions.js";
import { UserService } from "./services/users.js";

export interface CoreOptions {
  dbFile: string;
  migrationsFolder: string;
  adminDiscordIds: string[];
  /** 上傳圖片相對路徑 → 對外 URL */
  imageUrl: (path: string) => string;
}

export interface Core {
  db: Db;
  events: CoreEventBus;
  users: UserService;
  menus: MenuService;
  submissions: SubmissionService;
  close(): void;
}

export function createCore(opts: CoreOptions): Core {
  const { db, sqlite } = openDb({ file: opts.dbFile, migrationsFolder: opts.migrationsFolder });
  const events = new CoreEventBus();
  const users = new UserService(db, new Set(opts.adminDiscordIds));
  const menus = new MenuService(db, events);
  const submissions = new SubmissionService(db, events, menus, opts.imageUrl);
  return { db, events, users, menus, submissions, close: () => sqlite.close() };
}

export * from "./db/schema.js";
export { CoreError } from "./errors.js";
export { CoreEventBus, type CoreEvents } from "./events.js";
export { MenuService, toMenuItemDto } from "./services/menu.js";
export { SubmissionService } from "./services/submissions.js";
export { UserService, toUserDto, type DiscordProfile } from "./services/users.js";
export type { Db } from "./db/index.js";
