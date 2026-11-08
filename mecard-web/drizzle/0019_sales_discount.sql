ALTER TABLE "commissions" ADD COLUMN "discount_off_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "sales_discount_cents" integer DEFAULT 0 NOT NULL;