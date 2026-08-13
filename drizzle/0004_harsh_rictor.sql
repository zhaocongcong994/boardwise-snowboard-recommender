PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_price_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`source_id` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`availability` text DEFAULT 'in_stock' NOT NULL,
	`observed_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `snowboard_models`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `catalog_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_price_snapshots`("id", "board_id", "source_id", "amount", "currency", "availability", "observed_at", "expires_at") SELECT "id", "board_id", "source_id", "amount", "currency", "availability", "observed_at", "expires_at" FROM `price_snapshots`;--> statement-breakpoint
DROP TABLE `price_snapshots`;--> statement-breakpoint
ALTER TABLE `__new_price_snapshots` RENAME TO `price_snapshots`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_price_snapshots_board_observed` ON `price_snapshots` (`board_id`,`observed_at`);--> statement-breakpoint
CREATE INDEX `idx_price_snapshots_expiry` ON `price_snapshots` (`expires_at`);