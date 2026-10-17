CREATE TABLE `companion_experiences` (
	`user_id` text NOT NULL,
	`companion_id` text NOT NULL,
	`scene_id` text NOT NULL,
	`choices_json` text DEFAULT '[]' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `companion_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
