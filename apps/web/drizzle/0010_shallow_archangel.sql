CREATE TABLE `jackpot_contribution` (
	`user_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`day` text NOT NULL,
	`tickets` integer NOT NULL,
	PRIMARY KEY(`user_id`, `game_id`, `day`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `jackpot_pool` (
	`id` text PRIMARY KEY NOT NULL,
	`pool` integer NOT NULL,
	`seed` integer DEFAULT 5000 NOT NULL,
	`cap` integer DEFAULT 50000 NOT NULL,
	`round` integer DEFAULT 1 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "jackpot_pool_shape" CHECK(seed >= 0 and cap > seed and pool >= 0 and pool <= cap and round >= 1)
);
--> statement-breakpoint
CREATE TABLE `jackpot_roll` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`user_id`, `day`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `jackpot_win` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`round` integer NOT NULL,
	`user_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`won_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `jackpot_win_won_at_idx` ON `jackpot_win` (`won_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `jackpot_win_round_uq` ON `jackpot_win` (`round`);--> statement-breakpoint
-- The one pool every arcade game shares, starting at its seed (hand-added: drizzle-kit writes no data).
INSERT INTO `jackpot_pool` (`id`, `pool`, `seed`, `cap`, `round`, `updated_at`) VALUES ('arcade', 5000, 5000, 50000, 1, unixepoch() * 1000);
