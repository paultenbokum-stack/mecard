import { Modal } from "@/components/account/Modal";
import { BuyCard, loadBuyCard } from "../../../cards/new/BuyCard";

export default async function BuyCardModal({ searchParams }: { searchParams: Promise<{ profile_id?: string }> }) {
  const data = await loadBuyCard((await searchParams).profile_id);
  return (
    <Modal title="Buy a new card" closeHref="/manage/cards/">
      <BuyCard {...data} />
    </Modal>
  );
}
