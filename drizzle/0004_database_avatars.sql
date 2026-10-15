CREATE TABLE `avatar_images` (
	`user_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`content_type` text NOT NULL,
	`bytes` blob NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `avatar_images_id_unique` ON `avatar_images` (`id`);