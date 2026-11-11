CREATE TABLE `pending_grant` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`source` text NOT NULL,
	`ledger_id` integer,
	`created_at` integer NOT NULL,
	`claimed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ledger_id`) REFERENCES `ticket_ledger`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pending_grant_unclaimed_idx` ON `pending_grant` (`user_id`,`game_id`) WHERE claimed_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX `pending_grant_ledger_idx` ON `pending_grant` (`ledger_id`);--> statement-breakpoint
CREATE INDEX `ticket_ledger_game_time_idx` ON `ticket_ledger` (`game_id`,`created_at`);