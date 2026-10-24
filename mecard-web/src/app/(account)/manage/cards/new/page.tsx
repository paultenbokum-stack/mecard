import type { Metadata } from "next";
import { Subnav } from "@/components/account/Bits";
import { BuyCard, loadBuyCard } from "./BuyCard";

export const metadata: Metadata = { title: "Buy a new card" };

// Opened from My Cards this shows in a modal (@modal/(.)cards/new).
export default async function BuyCardPage({ searchParams }: { searchParams: Promise<{ profile_id?: string }> }) {
  const data = await loadBuyCard((await searchParams).profile_id);
  return (
    <div className="acc__wrap">
      <Subnav active="cards" />
      <h1>Buy a new card</h1>
      <BuyCard {...data} />
    </div>
  );
}
