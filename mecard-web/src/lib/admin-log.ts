import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { adminLog, users } from "@/db/schema";

// Who changed what in the staff management screens.

export type LogEntity = "user" | "company" | "profile" | "card";

export async function logAdmin(actorId: number, entity: LogEntity, entityId: number, action: string, detail = "") {
  await db.insert(adminLog).values({ actorId, entity, entityId, action, detail: detail.slice(0, 2000) });
}

export function recentAdminLog(entity: LogEntity, entityId: number, limit = 20) {
  return db
    .select({ l: adminLog, actor: sql<string | null>`coalesce(nullif(${users.displayName}, ''), ${users.email})` })
    .from(adminLog)
    .leftJoin(users, eq(users.id, adminLog.actorId))
    .where(and(eq(adminLog.entity, entity), eq(adminLog.entityId, entityId)))
    .orderBy(desc(adminLog.createdAt))
    .limit(limit);
}
