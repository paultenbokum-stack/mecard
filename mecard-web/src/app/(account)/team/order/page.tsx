import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { imageUrl } from "@/lib/images/paths";
import { productPriceCents } from "@/lib/product-prices";
import { requireUserId } from "@/lib/session";
import { teamCompanies } from "@/lib/team";
import { TeamOrder } from "./TeamOrder";
import "../team.css";

export const metadata: Metadata = { title: { absolute: "Team size and pay - MeCard" } };

export default async function TeamOrderPage() {
  const userId = await requireUserId("/team/order/");
  const [company] = await teamCompanies(userId);
  if (!company) redirect("/team/setup/");
  return (
    <div className="team">
      <ol className="team-steps" aria-label="Progress">
        <li className="is-done">1 Your account, done</li>
        <li className="is-done">2 Your company, done</li>
        <li className="is-now" aria-current="step">3 Team size and pay</li>
      </ol>
      <TeamOrder prices={await productPriceCents()} company={company.name} logo={company.logoPath ? imageUrl(company.logoPath, 320) : null} colour={company.accentColour || "var(--brand)"} />
    </div>
  );
}
