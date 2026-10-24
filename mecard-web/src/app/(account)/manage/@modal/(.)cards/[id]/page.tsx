import { Modal } from "@/components/account/Modal";
import { EditCard, loadCardEditor } from "../../../cards/[id]/EditCard";

// Closing goes back to the tab it was opened from (?tab=), or to the card's new
// tab when a save moved it: a save refreshes this, so data.back is current.
export default async function EditCardModal({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const data = await loadCardEditor(id, sp.tab);
  return (
    <Modal title={data.card.label || `Edit ${data.type.toLowerCase()}`} closeHref={data.back} wide={!!data.design}>
      <EditCard data={data} />
    </Modal>
  );
}
