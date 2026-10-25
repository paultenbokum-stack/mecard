import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.local)");

// Same connection logic as GuestWave: Cloud SQL on Cloud Run is a unix socket
// passed as `?host=/cloudsql/<instance>`; a plain TCP URL (local dev) passes through.
// Pool is kept small to suit the smallest Cloud SQL tier.
export function connect(databaseUrl: string, max = 5) {
  const socketMatch = databaseUrl.match(/[?&]host=([^&]*)/);
  if (!socketMatch) return postgres(databaseUrl, { max });
  const socketDir = decodeURIComponent(socketMatch[1]);
  const url = databaseUrl.replace(/\?.*$/, "").replace("@/", "@localhost/");
  return postgres(url, { max, path: `${socketDir}/.s.PGSQL.5432` });
}

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };
const client = globalForDb.pgClient ?? connect(DATABASE_URL);
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
