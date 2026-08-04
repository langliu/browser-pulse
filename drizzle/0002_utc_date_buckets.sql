PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `daily_aggregates_new` (
	`project_id` text NOT NULL,
	`utc_date` text NOT NULL,
	`browser_family` text NOT NULL,
	`browser_major` text DEFAULT '' NOT NULL,
	`os_family` text NOT NULL,
	`device_class` text NOT NULL,
	`detection_source` text NOT NULL,
	`event_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`project_id`, `utc_date`, `browser_family`, `browser_major`, `os_family`, `device_class`, `detection_source`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `daily_aggregates_new` (
	`project_id`,
	`utc_date`,
	`browser_family`,
	`browser_major`,
	`os_family`,
	`device_class`,
	`detection_source`,
	`event_count`,
	`updated_at`
)
SELECT
	`project_id`,
	strftime('%Y-%m-%d', `collected_at` / 1000, 'unixepoch') AS `utc_date`,
	`browser_family`,
	COALESCE(`browser_major`, '') AS `browser_major`,
	`os_family`,
	`device_class`,
	`detection_source`,
	COUNT(*) AS `event_count`,
	MAX(`collected_at`) AS `updated_at`
FROM `raw_events`
GROUP BY
	`project_id`,
	strftime('%Y-%m-%d', `collected_at` / 1000, 'unixepoch'),
	`browser_family`,
	COALESCE(`browser_major`, ''),
	`os_family`,
	`device_class`,
	`detection_source`;--> statement-breakpoint
INSERT OR IGNORE INTO `daily_aggregates_new` (
	`project_id`,
	`utc_date`,
	`browser_family`,
	`browser_major`,
	`os_family`,
	`device_class`,
	`detection_source`,
	`event_count`,
	`updated_at`
)
SELECT
	`project_id`,
	`local_date`,
	`browser_family`,
	`browser_major`,
	`os_family`,
	`device_class`,
	`detection_source`,
	`event_count`,
	`updated_at`
FROM `daily_aggregates`;--> statement-breakpoint
DROP TABLE `daily_aggregates`;--> statement-breakpoint
ALTER TABLE `daily_aggregates_new` RENAME TO `daily_aggregates`;--> statement-breakpoint
UPDATE `projects` SET `timezone` = 'UTC' WHERE `timezone` = 'Asia/Shanghai';--> statement-breakpoint
PRAGMA foreign_keys=ON;