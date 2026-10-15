CREATE TABLE `plaza_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plaza_comments_post_created_idx` ON `plaza_comments` (`post_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `plaza_comments_author_idx` ON `plaza_comments` (`author_id`);--> statement-breakpoint
CREATE TABLE `plaza_likes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plaza_likes_post_user_uq` ON `plaza_likes` (`post_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `plaza_likes_post_idx` ON `plaza_likes` (`post_id`);--> statement-breakpoint
CREATE TABLE `plaza_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_id` text NOT NULL,
	`category` text NOT NULL,
	`audience` text DEFAULT 'national' NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plaza_posts_status_created_idx` ON `plaza_posts` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `plaza_posts_author_idx` ON `plaza_posts` (`author_id`);