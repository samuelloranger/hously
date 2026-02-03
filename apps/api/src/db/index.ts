import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

// Use DATABASE_URL as-is in production, fallback to localhost for local dev
const connectionString = process.env.DATABASE_URL
  || "postgresql://hously:hously_password@localhost:5433/hously";

import * as schema from './schema';
import * as relations from './relations';

const pool = new pg.Pool({
  connectionString,
});

export const db = drizzle(pool, { schema: { ...schema, ...relations } });
