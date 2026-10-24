PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_game_save` (
	`user_id` text NOT NULL,
	`game_slug` text NOT NULL,
	`slot` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `game_slug`, `slot`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_game_save`("user_id", "game_slug", "slot", "data", "version", "updated_at") SELECT "user_id", "game_slug", 0, "data", "version", "updated_at" FROM `game_save`;--> statement-breakpoint
DROP TABLE `game_save`;--> statement-breakpoint
ALTER TABLE `__new_game_save` RENAME TO `game_save`;--> statement-breakpoint
PRAGMA foreign_keys=ON;