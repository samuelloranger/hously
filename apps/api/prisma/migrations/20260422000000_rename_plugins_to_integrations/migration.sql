-- Rename plugins table to integrations
ALTER TABLE "plugins" RENAME TO "integrations";

-- Rename index
ALTER INDEX "ix_plugins_type" RENAME TO "ix_integrations_type";
