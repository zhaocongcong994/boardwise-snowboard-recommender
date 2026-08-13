CREATE TABLE `catalog_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_key` text NOT NULL,
	`change_type` text NOT NULL,
	`payload_json` text NOT NULL,
	`source_url` text NOT NULL,
	`content_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`collected_at` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text,
	`review_note` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_catalog_changes_hash` ON `catalog_changes` (`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_catalog_changes_status_collected` ON `catalog_changes` (`status`,`collected_at`);--> statement-breakpoint
CREATE TABLE `catalog_review_events` (
	`id` text PRIMARY KEY NOT NULL,
	`change_id` text NOT NULL,
	`action` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`reviewer_email` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`change_id`) REFERENCES `catalog_changes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_catalog_review_events_change` ON `catalog_review_events` (`change_id`);--> statement-breakpoint
CREATE TABLE `catalog_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_name` text NOT NULL,
	`url` text NOT NULL,
	`verified_at` text NOT NULL,
	`content_hash` text,
	`is_official` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `snowboard_models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_catalog_sources_board_url` ON `catalog_sources` (`board_id`,`url`);--> statement-breakpoint
CREATE INDEX `idx_catalog_sources_board` ON `catalog_sources` (`board_id`);--> statement-breakpoint
CREATE TABLE `collection_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`sources_checked` integer DEFAULT 0 NOT NULL,
	`changes_found` integer DEFAULT 0 NOT NULL,
	`errors_json` text DEFAULT '[]' NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_collection_runs_started` ON `collection_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `price_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`source_id` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`availability` text DEFAULT 'in_stock' NOT NULL,
	`observed_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `snowboard_models`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `catalog_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_price_snapshots_board_observed` ON `price_snapshots` (`board_id`,`observed_at`);--> statement-breakpoint
CREATE INDEX `idx_price_snapshots_expiry` ON `price_snapshots` (`expires_at`);--> statement-breakpoint
CREATE TABLE `snowboard_models` (
	`id` text PRIMARY KEY NOT NULL,
	`brand` text NOT NULL,
	`model` text NOT NULL,
	`season` text NOT NULL,
	`audience` text DEFAULT 'adult' NOT NULL,
	`levels_json` text NOT NULL,
	`styles_json` text NOT NULL,
	`flex` integer NOT NULL,
	`profile` text NOT NULL,
	`shape` text NOT NULL,
	`color` text DEFAULT '#d8ff55' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`published_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_snowboard_models_identity` ON `snowboard_models` (`brand`,`model`,`season`,`audience`);--> statement-breakpoint
CREATE INDEX `idx_snowboard_models_status` ON `snowboard_models` (`status`);--> statement-breakpoint
CREATE TABLE `snowboard_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`size` integer NOT NULL,
	`waist` integer NOT NULL,
	`weight_min` real NOT NULL,
	`weight_max` real NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `snowboard_models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_snowboard_variants_board_size_waist` ON `snowboard_variants` (`board_id`,`size`,`waist`);--> statement-breakpoint
CREATE INDEX `idx_snowboard_variants_board` ON `snowboard_variants` (`board_id`);