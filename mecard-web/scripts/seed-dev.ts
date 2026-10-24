// Demo data for local development, when you don't have the WordPress database.
//   npm run db:seed   → demo@mecard.co.za / password123 (admin), one company, one profile, one card
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/client");
  const s = await import("../src/db/schema");
  const { hashPassword } = await import("../src/lib/password");

  const [user] = await db
    .insert(s.users)
    .values({ email: "demo@mecard.co.za", passwordHash: await hashPassword("password123"), firstName: "Demo", lastName: "User", displayName: "Demo User", isAdmin: true })
    .returning();
  const [company] = await db.insert(s.companies).values({ name: "Demo Company", slug: "demo-company", ownerId: user.id, accentColour: "#1e88e5" }).returning();
  const [profile] = await db
    .insert(s.profiles)
    .values({ slug: "demo-user", ownerId: user.id, managerId: user.id, companyId: company.id, type: "pro", firstName: "Demo", lastName: "User", jobTitle: "Founder", email: user.email })
    .returning();
  await db.insert(s.cards).values({ slug: "classiccard-demo-1", title: "Demo card", ownerId: user.id, profileId: profile.id, companyId: company.id, type: "classiccard" });
  console.log("Seeded demo@mecard.co.za / password123 with a company, a pro profile and a card (/t/classiccard-demo-1/).");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
