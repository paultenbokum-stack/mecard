ALTER TABLE "companies" ADD COLUMN "logo_width" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_x" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_y" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_height" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_bg" varchar(20) DEFAULT '' NOT NULL;