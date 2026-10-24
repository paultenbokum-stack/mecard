import { Modal } from "@/components/account/Modal";
import { AddProfile, loadAddProfile } from "../../../profile/new/AddProfile";

export default async function AddProfileModal() {
  const data = await loadAddProfile();
  return (
    <Modal title="Add a new profile" closeHref="/manage/">
      <AddProfile {...data} />
    </Modal>
  );
}
