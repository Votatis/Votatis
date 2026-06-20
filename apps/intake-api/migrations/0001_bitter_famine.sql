CREATE TABLE `admin_password_reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_admin_reset_token_hash` ON `admin_password_reset_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_admin_reset_user` ON `admin_password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `admin_refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_admin_refresh_user` ON `admin_refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_admin_refresh_token_hash` ON `admin_refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_admin_users_username` ON `admin_users` (`username`);