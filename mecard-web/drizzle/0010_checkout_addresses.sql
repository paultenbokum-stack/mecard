ALTER TABLE "orders" ADD COLUMN "shipping_first_name" varchar(100) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_last_name" varchar(100) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_company" varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_address" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_address" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "shipping_address" jsonb;