CREATE TABLE `checkins` (
	`id` varchar(36) NOT NULL,
	`wedding_id` varchar(36) NOT NULL,
	`function_id` varchar(36) NOT NULL,
	`household_id` varchar(36),
	`guest_name` varchar(150) NOT NULL,
	`actual_party_size` int NOT NULL DEFAULT 1,
	`is_walkin` boolean NOT NULL DEFAULT false,
	`notes` text,
	`checked_in_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checkins_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_checkins_func_hh` UNIQUE(`function_id`,`household_id`)
);
--> statement-breakpoint
ALTER TABLE `households` MODIFY COLUMN `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `checkins` ADD CONSTRAINT `checkins_wedding_id_weddings_id_fk` FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkins` ADD CONSTRAINT `checkins_function_id_functions_id_fk` FOREIGN KEY (`function_id`) REFERENCES `functions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkins` ADD CONSTRAINT `checkins_household_id_households_id_fk` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_checkins_func` ON `checkins` (`function_id`);--> statement-breakpoint
CREATE INDEX `idx_checkins_wedding` ON `checkins` (`wedding_id`);