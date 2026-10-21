import Link from "next/link";
import { CARD_TYPES } from "@/components/account/Bits";
import { AdminHeader, Card } from "@/components/admin/ui";
import { ENCODING_HEADINGS, encodingRow, inFile } from "@/lib/encoding";
import { encodingCards } from "@/lib/encoding-data";
import { siteUrl } from "@/lib/site";

export const metadata = { title: "Encoding file" };

const cardUrl = (slug: string) => siteUrl(`/t/${slug}/`);

// Toolset's Encoding CSV page: the batch between "design received" and
// "packaged", with the files for GoToTags and Bartender.
export default async function EncodingPage() {
  const list = await encodingCards();
  const encode = list.filter((c) => inFile("encoding", c.type)).length;
  const print = list.filter((c) => inFile("print", c.type)).length;
  const images = new Set(list.filter((c) => inFile("print", c.type)).flatMap((c) => [c.frontPath, c.backPath].filter(Boolean))).size;

  return (
    <>
      <AdminHeader title="Encoding file" back={{ href: "/admin/cards/", label: "Card processing" }} />
      <Card>
        <p style={{ marginTop: 0 }}>
          Cards whose design is received and that aren&apos;t packaged yet: <strong>{list.length}</strong>. Tick Packaged on{" "}
          <Link href="/admin/cards/?stage=pack">Card processing</Link> once a card is done and it leaves this batch.
        </p>
        <div className="adm-head__actions">
          <a href="/admin/encoding/encoding.csv" className="adm-btn adm-btn--primary" download>
            <i className="fas fa-file-csv" aria-hidden="true" /> Encoding CSV ({encode})
          </a>
          <a href="/admin/encoding/print.csv" className="adm-btn" download>
            <i className="fas fa-print" aria-hidden="true" /> Print CSV ({print})
          </a>
          <a href="/admin/encoding/images.zip" className="adm-btn" download>
            <i className="fas fa-file-archive" aria-hidden="true" /> Download images ({images})
          </a>
        </div>
        <p className="adm-help" style={{ marginBottom: 0 }}>
          Encoding CSV: custom cards, classic cards and phone tags, for GoToTags. Print CSV: custom and classic cards, for Bartender; its Card
          Front and Card Back columns name the files in the images zip (the original uploads, not the web copies).
        </p>
      </Card>
      <div className="adm-table-wrap">
        <table className="adm-table adm-table--tight">
          <thead>
            <tr>
              <th>Type</th>
              {ENCODING_HEADINGS.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td className="adm-small">
                  <Link href={`/admin/cards/${c.id}/`}>{CARD_TYPES[c.type] ?? c.type}</Link>
                </td>
                {encodingRow(c, cardUrl).map((v, i) => (
                  <td key={i} className="adm-small">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
            {!list.length ? (
              <tr>
                <td colSpan={ENCODING_HEADINGS.length + 1} className="adm-muted">
                  Nothing to encode or print.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
