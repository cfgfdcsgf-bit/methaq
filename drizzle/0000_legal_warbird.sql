CREATE TYPE "public"."material_kind" AS ENUM('quran', 'sunnah', 'library', 'learning', 'adhkar');--> statement-breakpoint
CREATE TYPE "public"."material_status" AS ENUM('draft', 'review', 'published');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "material_kind" NOT NULL,
	"title" varchar(255) NOT NULL,
	"category" varchar(120),
	"body" text NOT NULL,
	"source" varchar(255),
	"grade" varchar(120),
	"status" "material_status" DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
