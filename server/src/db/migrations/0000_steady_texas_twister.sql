CREATE TABLE `audit_log` (
	`id` varchar(36) NOT NULL,
	`wedding_id` varchar(36) NOT NULL,
	`actor_type` enum('planner','guest','system') NOT NULL,
	`actor_id` varchar(36),
	`action` varchar(100) NOT NULL,
	`entity_type` varchar(50) NOT NULL,
	`entity_id` varchar(36) NOT NULL,
	`old_values` json,
	`new_values` json,
	`ip_address` varchar(45),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `functions` (
	`id` varchar(36) NOT NULL,
	`wedding_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`date_time` datetime NOT NULL,
	`venue` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `functions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `household_functions` (
	`id` varchar(36) NOT NULL,
	`household_id` varchar(36) NOT NULL,
	`function_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `household_functions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_household_function` UNIQUE(`household_id`,`function_id`)
);
--> statement-breakpoint
CREATE TABLE `households` (
	`id` varchar(36) NOT NULL,
	`wedding_id` varchar(36) NOT NULL,
	`name` varchar(150) NOT NULL,
	`primary_contact_name` varchar(100) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`expected_party_size` int NOT NULL DEFAULT 1,
	`invite_token` varchar(64) NOT NULL,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `households_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_households_token` UNIQUE(`invite_token`)
);
--> statement-breakpoint
CREATE TABLE `planners` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`name` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `planners_id` PRIMARY KEY(`id`),
	CONSTRAINT `planners_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `rsvps` (
	`id` varchar(36) NOT NULL,
	`function_id` varchar(36) NOT NULL,
	`household_id` varchar(36) NOT NULL,
	`status` enum('yes','no','maybe') NOT NULL,
	`party_size` int NOT NULL DEFAULT 0,
	`veg_count` int NOT NULL DEFAULT 0,
	`nonveg_count` int NOT NULL DEFAULT 0,
	`checked_in` boolean NOT NULL DEFAULT false,
	`actual_party_size` int,
	`dietary_notes` text,
	`responded_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rsvps_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_rsvp_func_hh` UNIQUE(`function_id`,`household_id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`planner_id` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weddings` (
	`id` varchar(36) NOT NULL,
	`planner_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`couple_names` varchar(200) NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weddings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_wedding_id_weddings_id_fk` FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `functions` ADD CONSTRAINT `functions_wedding_id_weddings_id_fk` FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `household_functions` ADD CONSTRAINT `household_functions_household_id_households_id_fk` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `household_functions` ADD CONSTRAINT `household_functions_function_id_functions_id_fk` FOREIGN KEY (`function_id`) REFERENCES `functions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `households` ADD CONSTRAINT `households_wedding_id_weddings_id_fk` FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rsvps` ADD CONSTRAINT `rsvps_function_id_functions_id_fk` FOREIGN KEY (`function_id`) REFERENCES `functions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rsvps` ADD CONSTRAINT `rsvps_household_id_households_id_fk` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_planner_id_planners_id_fk` FOREIGN KEY (`planner_id`) REFERENCES `planners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weddings` ADD CONSTRAINT `weddings_planner_id_planners_id_fk` FOREIGN KEY (`planner_id`) REFERENCES `planners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_audit_wedding_created` ON `audit_log` (`wedding_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_functions_wedding` ON `functions` (`wedding_id`);--> statement-breakpoint
CREATE INDEX `idx_hf_function` ON `household_functions` (`function_id`);--> statement-breakpoint
CREATE INDEX `idx_households_wedding_phone` ON `households` (`wedding_id`,`phone`);--> statement-breakpoint
CREATE INDEX `idx_weddings_planner` ON `weddings` (`planner_id`);