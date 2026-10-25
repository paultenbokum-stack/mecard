ALTER TABLE "users" ADD COLUMN "first_session_id" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "acquisition" jsonb;