CREATE TABLE `ledger_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`kind` text NOT NULL,
	`session_id` integer,
	`order_line_id` integer,
	`memo` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ledger_entries_user_idx` ON `ledger_entries` (`user_id`);--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store_id` integer NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `menu_items_store_idx` ON `menu_items` (`store_id`);--> statement-breakpoint
CREATE TABLE `menu_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submitted_by` integer NOT NULL,
	`store_name_hint` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`image_paths_json` text DEFAULT '[]' NOT NULL,
	`ai_result_json` text,
	`edited_result_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` integer,
	`reviewed_at` integer,
	`reject_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `menu_submissions_status_idx` ON `menu_submissions` (`status`);--> statement-breakpoint
CREATE TABLE `order_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`menu_item_id` integer,
	`item_name` text NOT NULL,
	`unit_price` integer NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	`removed_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `order_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_lines_session_idx` ON `order_lines` (`session_id`);--> statement-breakpoint
CREATE INDEX `order_lines_user_idx` ON `order_lines` (`user_id`);--> statement-breakpoint
CREATE TABLE `order_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store_id` integer NOT NULL,
	`store_snapshot_json` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`opened_by` integer NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`purge_after` integer,
	`purged_at` integer,
	`guild_id` text,
	`channel_id` text,
	`menu_message_ids_json` text DEFAULT '[]' NOT NULL,
	`summary_message_id` text,
	`web_token` text NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opened_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_sessions_web_token_unique` ON `order_sessions` (`web_token`);--> statement-breakpoint
CREATE INDEX `order_sessions_status_idx` ON `order_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `order_sessions_channel_idx` ON `order_sessions` (`channel_id`);--> statement-breakpoint
CREATE TABLE `stores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`menu_version` integer DEFAULT 0 NOT NULL,
	`menu_updated_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stores_name_key_idx` ON `stores` (`name_key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_id` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`role` text DEFAULT 'member' NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_discord_id_unique` ON `users` (`discord_id`);--> statement-breakpoint
CREATE TABLE `web_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
