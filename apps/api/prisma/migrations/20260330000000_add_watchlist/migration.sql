-- CreateTable
CREATE TABLE "watchlist_items" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "media_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "poster_url" TEXT,
    "overview" TEXT,
    "release_year" INTEGER,
    "vote_average" DOUBLE PRECISION,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_watchlist_user_tmdb_type" ON "watchlist_items"("user_id", "tmdb_id", "media_type");

-- CreateIndex
CREATE INDEX "ix_watchlist_user_added_at" ON "watchlist_items"("user_id", "added_at");

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
