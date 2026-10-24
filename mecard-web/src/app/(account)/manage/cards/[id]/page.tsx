import type { Metadata } from "next";
import Link from "next/link";
import { Subnav } from "@/components/account/Bits";
import { EditCard, loadCardEditor } from "./EditCard";

export const metadata: Metadata = { title: "Edit card" };

// Opened from My Cards this shows in a modal (@modal/(.)cards/[id]); a direct
// visit, refresh or shared link gets this full page.
export default async function EditCardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const data = await loadCardEditor(id, sp.tab);
  return (
    <div className="acc__wrap acc__wrap--wide">
      <Subnav active="cards" />
      <p className="acc__eyebrow">
        <Link href={data.back}>My Cards</Link>
      </p>
      <h1>{data.card.label || data.type}</h1>
      <EditCard data={data} />
    </div>
  );
}
