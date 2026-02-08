import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// Keep backward-compatible export name
export const db = prisma;
