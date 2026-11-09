ALTER TABLE "companies" ADD COLUMN "logo_width" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_padding" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_bg" varchar(20) DEFAULT '' NOT NULL;