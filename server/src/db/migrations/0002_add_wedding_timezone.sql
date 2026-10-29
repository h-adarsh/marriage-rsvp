ALTER TABLE `weddings` ADD COLUMN `timezone` varchar(50) NOT NULL DEFAULT 'Asia/Kolkata';--> statement-breakpoint
ALTER TABLE `checkins` DROP FOREIGN KEY `checkins_household_id_households_id_fk`;--> statement-breakpoint
ALTER TABLE `checkins` ADD CONSTRAINT `checkins_household_id_households_id_fk` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE CASCADE;
