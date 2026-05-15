-- CreateTable
CREATE TABLE "minecraft_servers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 25565,
    "poll_interval_minutes" INTEGER NOT NULL DEFAULT 5,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "widget_view" TEXT NOT NULL DEFAULT 'compact',
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "online_players" INTEGER,
    "max_players" INTEGER,
    "version" TEXT,
    "motd" TEXT,
    "latency_ms" INTEGER,
    "favicon" TEXT,
    "player_sample" JSONB,
    "last_checked_at" TIMESTAMP(3),
    "last_status_change_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "minecraft_servers_pkey" PRIMARY KEY ("id")
);
