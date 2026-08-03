DROP INDEX `workspaces_owner_user_id_unique`;--> statement-breakpoint
CREATE INDEX `workspaces_owner_user_id_idx` ON `workspaces` (`owner_user_id`);