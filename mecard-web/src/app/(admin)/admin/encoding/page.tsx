import Link from "next/link";
import { CARD_TYPES } from "@/components/account/Bits";
import { AdminHeader, Card } from "@/components/admin/ui";
import { artworkFilename, ENCODING_HEADINGS, encodingRow, inFile } from "@/lib/encoding";
import { encodingCards } from "@/lib/encoding-data";
import { siteUrl } from "@/lib/site";
import { EncodingTable, type EncodingTableRow } from "./EncodingTable";

export const metadata = { title: "Encoding file" };

const cardUrl = (slug: string) => siteUrl(`/t/${slug}/`);

// Toolset's Encoding CSV page: the batch between "design received" and
// "packaged", with the files for GoToTags and Bartender for the ticked cards.
export default async function EncodingPage() {
  const list = await encodingCards();
  const rows: EncodingTableRow[] = list.map((c) => ({
    id: c.id,
    type: c.type,
    typeLabel: CARD_TYPES[c.type] ?? c.type,
    order: c.orderId,
    company: c.companyName ?? "",
    encode: inFile("encoding", c.type),
    print: inFile("print", c.type),
    images: inFile("print", c.type) ? [c.frontPath, c.backPath].map(artworkFilename).filter(Boolean) : [],
    cells: encodingRow(c, cardUrl),
  }));

  return (
    <>
      <AdminHeader title="Encoding file" back={{ href: "/admin/cards/", label: "Card processing" }} />
      <Card>
        <p style={{ marginTop: 0 }}>
          Cards whose design is received and that aren&apos;t packaged yet: <strong>{list.length}</strong>. Tick the cards to produce, then download
          their files. Tick Packaged on <Link href="/admin/cards/?stage=pack">Card processing</Link> once a card is done and it leaves this batch.
        </p>
        <p className="adm-help" style={{ marginBottom: 0 }}>
          Encoding CSV: custom cards, classic cards and phone tags, for GoToTags. Print CSV: custom and classic cards, for Bartender; its Card
          Front and Card Back columns name the files in the images zip (the original uploads, not the web copies).
        </p>
      </Card>
      <EncodingTable rows={rows} headings={ENCODING_HEADINGS} />
    </>
  );
}
