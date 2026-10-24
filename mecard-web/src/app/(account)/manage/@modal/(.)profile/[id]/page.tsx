import { Modal } from "@/components/account/Modal";
import { manageBack } from "@/lib/card-tabs";
import { EditProfile, loadProfileEditor } from "../../../profile/[id]/EditProfile";

export default async function EditProfileModal({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string; back?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const data = await loadProfileEditor(id);
  return (
    <Modal title={`Edit ${data.name}`} closeHref={manageBack(sp.back)} wide>
      <EditProfile data={data} done={sp.done} />
    </Modal>
  );
}
