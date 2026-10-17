ALTER TABLE `users` ADD `verified_until` text;--> statement-breakpoint
ALTER TABLE `verification_requests` ADD `evidence_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `verification_requests` ADD `encrypted_evidence` text;--> statement-breakpoint
ALTER TABLE `verification_requests` ADD `evidence_expires_at` text;--> statement-breakpoint
ALTER TABLE `verification_requests` ADD `identity_key` text;--> statement-breakpoint
ALTER TABLE `verification_requests` ADD `report_key` text;--> statement-breakpoint
ALTER TABLE `verification_requests` ADD `enrollment_until` text;--> statement-breakpoint
ALTER TABLE `verification_requests` ADD `review_note` text;--> statement-breakpoint
ALTER TABLE `verification_requests` ADD `reviewed_checks_json` text;