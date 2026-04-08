import { prisma } from "../src/db";
const titleNeedle = process.argv[2] ?? "Remove Sonarr";

(async () => {
  try {
    const tasks = await p.boardTask.findMany({
      where: {
        OR: [
          { title: { contains: titleNeedle, mode: "insensitive" } },
          { description: { contains: titleNeedle, mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, description: true, status: true },
    });
    console.log(JSON.stringify(tasks, null, 2));
    if (tasks.length === 0) {
      const any = await p.boardTask.findMany({
        take: 200,
        select: { id: true, title: true },
        orderBy: { id: "desc" },
      });
      const hit = any.filter(
        (t) =>
          t.title.toLowerCase().includes("radarr") ||
          t.title.toLowerCase().includes("sonarr"),
      );
      console.log("fallback radarr/sonarr titles:", JSON.stringify(hit, null, 2));
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
