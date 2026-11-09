import { redirect } from "next/navigation";

// Team setup now happens in the dashboard: "Add new company" on Companies
// builds the company from its website and opens the company editor.
export default function TeamSetupPage() {
  redirect("/manage/companies/?add=1&from=order#add-company");
}
