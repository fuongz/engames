CREATE TABLE `coupon` (
	`code` text PRIMARY KEY NOT NULL,
	`game` text,
	`rewards` text NOT NULL,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`disabled` integer DEFAULT false NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "coupon_code_shape" CHECK(code = upper(code) and instr(code, ' ') = 0 and instr(code, '-') = 0),
	CONSTRAINT "coupon_rewards_array" CHECK(json_valid(rewards) and json_type(rewards) = 'array')
);
--> statement-breakpoint
CREATE TABLE `coupon_redemption` (
	`code` text NOT NULL,
	`user_id` text NOT NULL,
	`game` text NOT NULL,
	`rewards` text NOT NULL,
	`redeemed_at` integer NOT NULL,
	PRIMARY KEY(`code`, `user_id`),
	FOREIGN KEY (`code`) REFERENCES `coupon`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `coupon_redemption_user_idx` ON `coupon_redemption` (`user_id`);