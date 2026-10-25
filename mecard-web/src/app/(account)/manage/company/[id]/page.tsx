import type { Metadata } from "next";
import { DoneNotice, Subnav } from "@/components/account/Bits";
import { Editor, loadCompany } from "./CompanyEdit";

export const metadata: Metadata = { title: "Edit company" };

// Opened from Companies this shows in a modal (@modal/(.)company/[id]); a
// direct visit, refresh or shared link gets this full page.
export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; done?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const company = await loadCompany(id, sp.tab);
  return (
    <div className="acc__wrap acc__wrap--wide">
      <Subnav active="companies" />
      <p className="acc__eyebrow">Company</p>
      <h1>{company.name}</h1>
      <DoneNotice done={sp.done} />
      <Editor company={company} />
    </div>
  );
}
