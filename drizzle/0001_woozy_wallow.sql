ALTER TABLE `orders` ADD `billing_address` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_address` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `admin_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `reviewed_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `reviewed_by` text;