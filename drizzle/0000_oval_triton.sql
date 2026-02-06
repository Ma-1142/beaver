CREATE TABLE `candidate_dates` (
	`candidate_id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`label` text NOT NULL,
	`date_value` text,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`poll_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `email_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`email` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` integer NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`poll_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `verification_poll_email_idx` ON `email_verifications` (`poll_id`,`email`);--> statement-breakpoint
CREATE TABLE `polls` (
	`poll_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'open' NOT NULL,
	`admin_token` text NOT NULL,
	`finalized_date_id` text,
	`deadline` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_token_idx` ON `polls` (`admin_token`);--> statement-breakpoint
CREATE TABLE `response_choices` (
	`response_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	FOREIGN KEY (`response_id`) REFERENCES `responses`(`response_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidate_dates`(`candidate_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `response_choice_pk` ON `response_choices` (`response_id`,`candidate_id`);--> statement-breakpoint
CREATE TABLE `responses` (
	`response_id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`respondent_token` text NOT NULL,
	`name` text,
	`email` text,
	`pin_hash` text,
	`pin_salt` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`poll_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `response_poll_respondent_idx` ON `responses` (`poll_id`,`respondent_token`);--> statement-breakpoint
CREATE INDEX `response_poll_email_idx` ON `responses` (`poll_id`,`email`);