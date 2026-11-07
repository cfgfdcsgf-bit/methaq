ALTER TYPE "public"."role" ADD VALUE 'owner';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "passwordHash" text;