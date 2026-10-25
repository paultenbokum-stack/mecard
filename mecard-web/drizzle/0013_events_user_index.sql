CREATE INDEX "events_user_name" ON "events" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "events_session" ON "events" USING btree ("session_id");