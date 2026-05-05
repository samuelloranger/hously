ALTER TABLE "ba_sessions"      ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "ba_accounts"      ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "ba_verifications" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "ba_passkeys"      ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
