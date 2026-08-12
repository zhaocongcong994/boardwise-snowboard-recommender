CREATE TABLE `recommendation_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`rating` integer NOT NULL,
	`selected_board` text,
	`profile_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
