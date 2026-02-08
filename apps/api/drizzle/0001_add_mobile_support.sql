-- Add avatar_url column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" varchar;

-- Create refresh_tokens table for mobile token refresh flow
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ix_refresh_tokens_token" ON "refresh_tokens" USING btree ("token");
CREATE INDEX IF NOT EXISTS "ix_refresh_tokens_user_id" ON "refresh_tokens" USING btree ("user_id");

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;

-- Create push_tokens table for mobile push notification registration
CREATE TABLE IF NOT EXISTS "push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "ix_push_tokens_token" ON "push_tokens" USING btree ("token");
CREATE INDEX IF NOT EXISTS "ix_push_tokens_user_id" ON "push_tokens" USING btree ("user_id");

ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
