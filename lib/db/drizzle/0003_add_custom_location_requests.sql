CREATE TABLE IF NOT EXISTS "custom_location_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"raw_value" text NOT NULL,
	"corrected_value" text NOT NULL,
	"linked_zone_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitted_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_location_requests" ADD CONSTRAINT "custom_location_requests_linked_zone_id_service_zones_id_fk" FOREIGN KEY ("linked_zone_id") REFERENCES "public"."service_zones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
 WHEN undefined_table THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clr_status_idx" ON "custom_location_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clr_type_idx" ON "custom_location_requests" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clr_created_at_idx" ON "custom_location_requests" USING btree ("created_at");
