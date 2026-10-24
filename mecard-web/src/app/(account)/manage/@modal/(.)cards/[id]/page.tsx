import { Modal } from "@/components/account/Modal";
import { EditCard, loadCardEditor } from "../../../cards/[id]/EditCard";

export default async function EditCardModal({ params }: { params: Promise<{ id: string }> }) {
  const data = await loadCardEditor((await params).id);
  return (
    <Modal title={data.card.label || `Edit ${data.type.toLowerCase()}`} closeHref="/manage/cards/" wide={!!data.design}>
      <EditCard data={data} />
    </Modal>
  );
}
