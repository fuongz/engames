CREATE TABLE `cosmetic_equipment` (
	`user_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`item_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `game_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `game_cosmetic` (
	`user_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`item_id` text NOT NULL,
	`price` integer NOT NULL,
	`purchased_at` integer NOT NULL,
	`ledger_id` integer,
	PRIMARY KEY(`user_id`, `game_id`, `item_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ledger_id`) REFERENCES `ticket_ledger`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "cosmetic_price_positive" CHECK("game_cosmetic"."price" > 0)
);

--> statement-breakpoint
-- One ownership INSERT is the entire transaction: debit, ledger, ownership.
-- Duplicate purchases DO NOTHING before this trigger; failures roll back every effect.
CREATE TRIGGER `game_cosmetic_purchase` AFTER INSERT ON `game_cosmetic`
BEGIN
  UPDATE ticket_wallet SET balance = balance - NEW.price, updated_at = NEW.purchased_at
    WHERE user_id = NEW.user_id AND balance >= NEW.price;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'insufficient-tickets') END;
  INSERT INTO ticket_ledger (user_id, game_id, delta, reason, created_at)
    VALUES (NEW.user_id, NEW.game_id, -NEW.price,
      'shop:' || (SELECT slug FROM game WHERE id = NEW.game_id) || ':skin-' || NEW.item_id, NEW.purchased_at);
  UPDATE game_cosmetic SET ledger_id = last_insert_rowid()
    WHERE user_id = NEW.user_id AND game_id = NEW.game_id AND item_id = NEW.item_id;
END;
