CREATE TABLE `allowance_grant` (
	`user_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`type` text NOT NULL,
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`granted_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `game_id`, `type`, `day`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "allowance_grant_day_shape" CHECK((type = 'welcome' and day = 'first') or (type = 'daily' and day glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'))
);
--> statement-breakpoint
CREATE TABLE `ticket_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ticket_ledger_user_time_idx` ON `ticket_ledger` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ticket_wallet` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`earned_total` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
