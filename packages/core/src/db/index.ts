import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";

export type Db = BetterSQLite3Database<typeof schema>;

export interface OpenDbOptions {
  /** 檔案路徑或 ":memory:" */
  file: string;
  /** drizzle migrations 資料夾（含 meta/_journal.json） */
  migrationsFolder: string;
}

export function openDb(opts: OpenDbOptions): { db: Db; sqlite: Database.Database } {
  const sqlite = new Database(opts.file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: opts.migrationsFolder });
  return { db, sqlite };
}

export { schema };
