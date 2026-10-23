CREATE TABLE `game_save` (
	`user_id` text NOT NULL,
	`game_slug` text NOT NULL,
	`data` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `game_slug`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
