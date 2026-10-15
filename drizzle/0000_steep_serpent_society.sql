CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`detail` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `match_intents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`intent` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_intents_match_user_uq` ON `match_intents` (`match_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `match_intents_match_idx` ON `match_intents` (`match_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_a_id` text NOT NULL,
	`user_b_id` text NOT NULL,
	`score` integer NOT NULL,
	`status` text DEFAULT 'suggested' NOT NULL,
	`shared_points_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_pair_uq` ON `matches` (`user_a_id`,`user_b_id`);--> statement-breakpoint
CREATE INDEX `matches_user_a_status_idx` ON `matches` (`user_a_id`,`status`);--> statement-breakpoint
CREATE INDEX `matches_user_b_status_idx` ON `matches` (`user_b_id`,`status`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `messages_match_created_idx` ON `messages` (`match_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`gender` text,
	`grade` text,
	`major` text,
	`campus` text,
	`hometown` text,
	`height` integer,
	`smoking` text,
	`looking_for` text DEFAULT 'relationship' NOT NULL,
	`bio` text,
	`interests_json` text DEFAULT '[]' NOT NULL,
	`photo_url` text,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `profiles_review_status_idx` ON `profiles` (`review_status`);--> statement-breakpoint
CREATE TABLE `questionnaire_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`question_id` text NOT NULL,
	`dimension` text NOT NULL,
	`answer` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questionnaire_user_question_uq` ON `questionnaire_answers` (`user_id`,`question_id`);--> statement-breakpoint
CREATE INDEX `questionnaire_user_dimension_idx` ON `questionnaire_answers` (`user_id`,`dimension`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reporter_id` text NOT NULL,
	`target_user_id` text NOT NULL,
	`category` text NOT NULL,
	`detail` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`admin_note` text,
	`created_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `reports_status_created_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`platform_user_id` text NOT NULL,
	`email` text,
	`display_name` text NOT NULL,
	`campus_email` text,
	`campus_verified` integer DEFAULT 0 NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`onboarding_step` integer DEFAULT 0 NOT NULL,
	`questionnaire_completed` integer DEFAULT 0 NOT NULL,
	`matching_enabled` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_platform_user_id_uq` ON `users` (`platform_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_campus_email_uq` ON `users` (`campus_email`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`status`);--> statement-breakpoint
CREATE TABLE `verification_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_user_created_idx` ON `verification_codes` (`user_id`,`created_at`);