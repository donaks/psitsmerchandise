CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_name` text NOT NULL,
	`email` text NOT NULL,
	`contact_no` text NOT NULL,
	`jersey_size` text NOT NULL,
	`amount_centavos` integer NOT NULL,
	`gcash_reference` text NOT NULL,
	`transaction_date` text,
	`receipt_hash` text NOT NULL,
	`receipt_key` text NOT NULL,
	`extracted_text` text NOT NULL,
	`validation_status` text DEFAULT 'pending_review' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_gcash_reference_unique` ON `orders` (`gcash_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_receipt_hash_unique` ON `orders` (`receipt_hash`);