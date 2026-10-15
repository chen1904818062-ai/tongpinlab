CREATE TABLE `verification_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`method` text NOT NULL,
	`university` text NOT NULL,
	`identifier` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_at` text,
	`reviewer_id` text
);
--> statement-breakpoint
CREATE INDEX `verification_requests_status_created_idx` ON `verification_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `verification_requests_user_idx` ON `verification_requests` (`user_id`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `personality_type` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `personality_scores_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `university` text;--> statement-breakpoint
ALTER TABLE `users` ADD `verification_method` text;--> statement-breakpoint
ALTER TABLE `users` ADD `verification_status` text DEFAULT 'unverified' NOT NULL;