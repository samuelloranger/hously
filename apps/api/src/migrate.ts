import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://hously:hously_password@localhost:5433/hously";

const pool = new pg.Pool({ connectionString });

const migrations = [
  {
    name: "0001_add_mobile_support",
    sql: `
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" varchar;

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
      DO $$ BEGIN
        ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

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
      DO $$ BEGIN
        ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `,
  },
];

async function migrate() {
  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        "name" varchar PRIMARY KEY NOT NULL,
        "applied_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    for (const migration of migrations) {
      const result = await client.query(
        `SELECT 1 FROM "_migrations" WHERE "name" = $1`,
        [migration.name]
      );

      if (result.rows.length > 0) {
        console.log(`  ✓ ${migration.name} (already applied)`);
        continue;
      }

      console.log(`  → Applying ${migration.name}...`);
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO "_migrations" ("name") VALUES ($1)`,
        [migration.name]
      );
      console.log(`  ✓ ${migration.name} applied`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate()
  .then(() => {
    console.log("All migrations up to date.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
