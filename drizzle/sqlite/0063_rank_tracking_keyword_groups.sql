CREATE TABLE `rank_tracking_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`color` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rank_tracking_groups_project_normalized_name_idx` ON `rank_tracking_groups` (`project_id`,`normalized_name`);--> statement-breakpoint
CREATE TABLE `rank_tracking_keyword_groups` (
	`keyword_id` text NOT NULL,
	`group_id` text NOT NULL,
	PRIMARY KEY(`keyword_id`, `group_id`),
	FOREIGN KEY (`keyword_id`) REFERENCES `rank_tracking_keywords`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `rank_tracking_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rank_tracking_keyword_groups_group_idx` ON `rank_tracking_keyword_groups` (`group_id`);