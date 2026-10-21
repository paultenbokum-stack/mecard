import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, profiles } from "@/db/schema";
import { PROCESSING_CARDS } from "./admin-card-queries";
import type { EncodingCard } from "./encoding";
import { imageDeps } from "./images/config";
import { uploadKey } from "./images/paths";

/** The encoding-csv view's cards: design received, not packaged yet. */
export function encodingCards(): Promise<EncodingCard[]> {
  return db
    .select({
      id: cards.id,
      slug: cards.slug,
      type: cards.type,
      label: cards.label,
      nameOnCard: cards.nameOnCard,
      jobTitleOnCard: cards.jobTitleOnCard,
      frontPath: cards.frontPath,
      backPath: cards.backPath,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      jobTitle: profiles.jobTitle,
    })
    .from(cards)
    .leftJoin(profiles, eq(profiles.id, cards.profileId))
    .where(and(PROCESSING_CARDS, eq(cards.designReceived, true), eq(cards.packaged, false)))
    .orderBy(asc(cards.id));
}

/**
 * The original artwork file for printing, not the WebP the pages show. The old
 * export downloaded the unoptimised copy WordPress kept under uploads/backup/;
 * new uploads keep their original under their own path.
 */
export async function readArtwork(path: string | null): Promise<Buffer | null> {
  const key = path ? uploadKey(path) : null;
  if (!key) return null;
  const { archive } = imageDeps();
  return (await archive.read(`backup/${key}`)) ?? (await archive.read(key));
}
