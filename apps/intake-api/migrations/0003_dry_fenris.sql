ALTER TABLE `reports` ADD `export_dirty` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_reports_export_dirty` ON `reports` (`export_dirty`);