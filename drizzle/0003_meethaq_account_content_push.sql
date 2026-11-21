CREATE TABLE "auth_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" varchar(24) NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"usedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "material_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"materialId" integer NOT NULL,
	"actorId" integer,
	"action" varchar(24) NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"materialId" integer NOT NULL,
	"reporterId" integer,
	"message" varchar(1000) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"resolvedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "push_devices" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"record" jsonb NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rafiq_usage" (
	"userId" integer NOT NULL,
	"day" varchar(10) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rafiq_usage_userId_day_pk" PRIMARY KEY("userId","day")
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"userId" integer PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "externalId" varchar(120);--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "archivedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tokenVersion" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_reports" ADD CONSTRAINT "material_reports_materialId_materials_id_fk" FOREIGN KEY ("materialId") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_reports" ADD CONSTRAINT "material_reports_reporterId_users_id_fk" FOREIGN KEY ("reporterId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_tokens_user_type_idx" ON "auth_tokens" USING btree ("userId","type");--> statement-breakpoint
CREATE INDEX "material_audit_material_idx" ON "material_audit" USING btree ("materialId","createdAt");--> statement-breakpoint
CREATE INDEX "material_reports_pending_idx" ON "material_reports" USING btree ("resolvedAt","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "materials_external_id_idx" ON "materials" USING btree ("externalId") WHERE "materials"."externalId" is not null;--> statement-breakpoint
CREATE INDEX "materials_kind_status_idx" ON "materials" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "materials_kind_category_idx" ON "materials" USING btree ("kind","category");--> statement-breakpoint
CREATE INDEX "materials_updated_idx" ON "materials" USING btree ("updatedAt");--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "email" IS NOT NULL GROUP BY lower("email") HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate account emails must be reconciled before applying the unique email index.';
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email")) WHERE "users"."email" is not null;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
SET LOCAL search_path TO public, extensions;--> statement-breakpoint
CREATE INDEX "materials_title_trgm_idx" ON "materials" USING gin ("title" gin_trgm_ops) WHERE "archivedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "materials_body_trgm_idx" ON "materials" USING gin ("body" gin_trgm_ops) WHERE "archivedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "materials_category_trgm_idx" ON "materials" USING gin ("category" gin_trgm_ops) WHERE "archivedAt" IS NULL;--> statement-breakpoint
-- These tables are accessed through the app's Express API and privileged Postgres connection.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "material_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "material_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "push_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rafiq_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_progress" ENABLE ROW LEVEL SECURITY;
