ALTER TABLE "commissions" ADD COLUMN "payout_date" varchar(10) DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "commissions_payout" ON "commissions" USING btree ("payout_date");