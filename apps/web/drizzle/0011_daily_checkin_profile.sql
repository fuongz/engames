CREATE TABLE `daily_checkin` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`streak_day` integer NOT NULL,
	`amount` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `day`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "daily_checkin_shape" CHECK(kind in ('claim', 'shield') and day glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' and streak_day >= 1 and amount >= 0 and (kind = 'claim' or amount = 0))
);
--> statement-breakpoint
CREATE TABLE `user_game_stat` (
	`user_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`plays` integer DEFAULT 0 NOT NULL,
	`first_played_at` integer NOT NULL,
	`last_played_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `game_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `user` ADD `profile_public` integer DEFAULT true NOT NULL;--> statement-breakpoint
-- The reserved `portal` game row: what the check-in's ticket_ledger rows point at (ticket_ledger.game_id is NOT NULL and
-- a check-in comes from no game). Never listed as a game, see docs/standards/database.md. Hand-added: drizzle-kit writes no data.
INSERT OR IGNORE INTO `game` (`slug`) VALUES ('portal');
