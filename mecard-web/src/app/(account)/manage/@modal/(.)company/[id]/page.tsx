import { DoneNotice } from "@/components/account/Bits";
import { Modal } from "@/components/account/Modal";
import { Editor, loadCompany } from "../../../company/[id]/CompanyEdit";

export default async function EditCompanyModal({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; done?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const company = await loadCompany(id, sp.tab);
  return (
    <Modal title={`Edit ${company.name}`} closeHref="/manage/companies/" wide>
      <DoneNotice done={sp.done} />
      <Editor company={company} />
    </Modal>
  );
}
