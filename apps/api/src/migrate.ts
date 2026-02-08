import { execSync } from "child_process";

console.log("Running Prisma migrations...");
try {
  execSync("bunx prisma migrate deploy", { stdio: "inherit" });
  console.log("All migrations applied successfully.");
  process.exit(0);
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
}
