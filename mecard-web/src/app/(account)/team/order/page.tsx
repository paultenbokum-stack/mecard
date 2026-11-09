import type { Metadata } from "next";
import { imageUrl } from "@/lib/images/paths";
import { productPriceCents } from "@/lib/product-prices";
import { requireUserId } from "@/lib/session";
import { teamCompanies } from "@/lib/team";
import { TeamSteps } from "../TeamSteps";
import { TeamOrder } from "./TeamOrder";
import "../team.css";

export const metadata: Metadata = { title: { absolute: "Team size and pay - MeCard" } };

// Step 2 of the team flow: the headcount and a package, straight after signing up.
// The company comes after paying; an account that already has one shows it here.
export default async function TeamOrderPage() {
  const userId = await requireUserId("/team/order/");
  const [company] = await teamCompanies(userId);
  return (
    <div className="team">
      <TeamSteps now="order" />
      <TeamOrder
        prices={await productPriceCents()}
        company={company?.name ?? ""}
        logo={company?.logoPath ? imageUrl(company.logoPath, 320) : null}
        colour={company?.accentColour || "var(--brand)"}
      />
    </div>
  );
}
