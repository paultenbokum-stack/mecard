CREATE TABLE "profile_slug_history" (
	"old_slug" varchar(200) PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_slug_history" ADD CONSTRAINT "profile_slug_history_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_slug_history_profile" ON "profile_slug_history" USING btree ("profile_id");