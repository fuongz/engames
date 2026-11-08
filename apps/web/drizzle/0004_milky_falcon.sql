CREATE TABLE `game_stat` (
	`game_slug` text PRIMARY KEY NOT NULL,
	`plays` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `history_consent` (
	`user_id` text PRIMARY KEY NOT NULL,
	`enabled` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `online_match` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_slug` text NOT NULL,
	`mode` text NOT NULL,
	`room_code` text NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`posted_at` integer NOT NULL,
	`played_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `online_match_post_uq` ON `online_match` (`room_code`,`posted_at`);--> statement-breakpoint
CREATE TABLE `online_match_player` (
	`match_id` integer NOT NULL,
	`seat` integer NOT NULL,
	`name` text NOT NULL,
	`user_id` text,
	`score` integer NOT NULL,
	`detail` text,
	`outcome` text,
	PRIMARY KEY(`match_id`, `seat`),
	FOREIGN KEY (`match_id`) REFERENCES `online_match`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `online_match_player_user_idx` ON `online_match_player` (`user_id`,`match_id`);