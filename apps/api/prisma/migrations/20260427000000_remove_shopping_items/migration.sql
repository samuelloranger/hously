-- DropForeignKey
ALTER TABLE "shopping_items" DROP CONSTRAINT IF EXISTS "shopping_items_added_by_fkey";
ALTER TABLE "shopping_items" DROP CONSTRAINT IF EXISTS "shopping_items_completed_by_fkey";

-- DropTable
DROP TABLE IF EXISTS "shopping_items";
