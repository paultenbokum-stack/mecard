import Link from "next/link";
import { CARD_TYPES } from "@/components/account/Bits";
import { AutoSubmitCheckbox } from "@/components/admin/AutoSubmitCheckbox";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Flash, Pager, pageNumber, SearchBox, Tabs } from "@/components/admin/ui";
import { saveCardLabelAction, setCardFlagAction, setTagCodeAction } from "@/lib/admin-card-actions";
import { CARD_PAGE_SIZE, cardStageCounts, isCardStage, listProcessingCards } from "@/lib/admin-card-queries";
import { CARD_FLAGS, CARD_STAGES, STAFF_FLAGS } from "@/lib/admin-cards";
import { imageUrl } from "@/lib/images/paths";
import { ORDER_STATUS_LABEL } from "@/lib/money";

export const metadata = { title: "Card processing" };

const SHORT: Record<string, string> = {
  designReceived: "Received",
  printJobSetUp: "Job set up",
  printed: "Printed",
  encoded: "Encoded",
  packaged: "Packaged",
  shipped: "Shipped",
};

// Toolset's Card Processing page (the tag-backend-admin view): every ordered
// card, newest first, with its production steps ticked off as it goes.
export default async function AdminCards({ searchParams }: { searchParams: Promise<AdminSearchParams & { stage?: string }> }) {
  const sp = await searchParams;
  const stage = isCardStage(sp.stage) ? sp.stage : "todo";
  const q = sp.q?.trim() || undefined;
  const page = pageNumber(sp.page);
  const [{ rows, total }, counts] = await Promise.all([listProcessingCards({ stage, q, page }), cardStageCounts()]);
  const todo = Object.entries(counts).reduce((t, [k, n]) => (k === "done" ? t : t + n), 0);
  const keep = { ...(stage !== "todo" ? { stage } : {}), ...(q ? { q } : {}), ...(page > 1 ? { page: String(page) } : {}) };
  const here = `/admin/cards/?${new URLSearchParams(keep)}`;
  const tab = (s: string) => `?${new URLSearchParams({ ...(s !== "todo" ? { stage: s } : {}), ...(q ? { q } : {}) })}`;

  return (
    <>
      <AdminHeader title="Card processing">
        <Link href="/admin/encoding/" className="adm-btn">
          <i className="fas fa-file-csv" aria-hidden="true" /> Encoding file
        </Link>
      </AdminHeader>
      <Flash saved={sp.saved} error={sp.error} />
      <Tabs
        tabs={Object.entries(CARD_STAGES).map(([s, label]) => ({
          href: tab(s),
          label,
          count: s === "todo" ? todo : s === "all" || s === "done" ? undefined : counts[s as keyof typeof counts],
          active: stage === s,
        }))}
      />
      <SearchBox q={q} placeholder="Card, label, owner, profile or order number" keep={{ stage: stage !== "todo" ? stage : undefined }} />
      <p className="adm-muted">
        To do leaves out shipped cards and cards whose order isn&apos;t paid yet. Ticks save straight away.
      </p>
      <div className="adm-table-wrap">
        <table className="adm-table adm-table--tight">
          <thead>
            <tr>
              <th>Order</th>
              <th>Preview</th>
              <th>Owner / profile</th>
              <th>Card</th>
              <th>Label</th>
              <th title="Design submitted by the customer">Design</th>
              {STAFF_FLAGS.map((f) => (
                <th key={f} className="adm-small">
                  {SHORT[f]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, orderStatus, ownerEmail, ownerName, first, last, jobTitle }) => {
              const thumb = imageUrl(c.frontPath, 160);
              return (
                <tr key={c.id}>
                  <td className="adm-nowrap">
                    {c.orderId ? (
                      <>
                        <Link href={`/admin/orders/${c.orderId}/`}>#{c.orderId}</Link>
                        <br />
                        <Badge status={orderStatus ?? ""}>{ORDER_STATUS_LABEL[orderStatus ?? ""] ?? orderStatus ?? "missing"}</Badge>
                      </>
                    ) : (
                      <span className="adm-muted">No order</span>
                    )}
                  </td>
                  <td>
                    <Link href={`/admin/cards/${c.id}/`} aria-label={`Card ${c.id}`}>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="adm-thumb" />
                      ) : (
                        <span className="adm-thumb adm-thumb--empty">{CARD_TYPES[c.type] ?? c.type}</span>
                      )}
                    </Link>
                  </td>
                  <td className="adm-small">
                    {c.ownerId ? <Link href={`/admin/users/${c.ownerId}/`}>{ownerName || ownerEmail}</Link> : "—"}
                    <div className="adm-muted">
                      {c.profileId ? <Link href={`/admin/profiles/${c.profileId}/`}>{`${first ?? ""} ${last ?? ""}`.trim() || `Profile ${c.profileId}`}</Link> : "No profile"}
                      {jobTitle ? ` · ${jobTitle}` : ""}
                    </div>
                  </td>
                  <td className="adm-small">
                    <Link href={`/admin/cards/${c.id}/`}>{CARD_TYPES[c.type] ?? c.type}</Link> <span className="adm-muted">#{c.id}</span>
                    {c.type === "keyring" ? (
                      <form action={setTagCodeAction} className="adm-inline" style={{ marginTop: 3 }}>
                        <input type="hidden" name="card_id" value={c.id} />
                        <input type="hidden" name="back" value={here} />
                        <input name="code" defaultValue={c.slug} className="adm-input adm-input--sm" style={{ width: 120 }} aria-label="Key ring code" />
                        <SubmitButton className="adm-btn adm-btn--sm">Set</SubmitButton>
                      </form>
                    ) : (
                      <div className="adm-muted">/t/{c.slug}/</div>
                    )}
                  </td>
                  <td>
                    <form action={saveCardLabelAction} className="adm-inline">
                      <input type="hidden" name="card_id" value={c.id} />
                      <input type="hidden" name="back" value={here} />
                      <input name="label" defaultValue={c.label} className="adm-input adm-input--sm" style={{ width: 120 }} aria-label="Label" />
                      <SubmitButton className="adm-btn adm-btn--sm">Save</SubmitButton>
                    </form>
                  </td>
                  <td>{c.designSubmitted ? <i className="fas fa-check-circle" style={{ color: "#1d6b3c" }} title="Design submitted" /> : null}</td>
                  {STAFF_FLAGS.map((f) => (
                    <td key={f}>
                      <form action={setCardFlagAction}>
                        <input type="hidden" name="card_id" value={c.id} />
                        <input type="hidden" name="flag" value={f} />
                        <input type="hidden" name="back" value={here} />
                        <AutoSubmitCheckbox name="value" checked={c[f]} label={`${CARD_FLAGS.find(([k]) => k === f)![1]}: card ${c.id}`} />
                      </form>
                    </td>
                  ))}
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={6 + STAFF_FLAGS.length} className="adm-muted">
                  No cards here.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} size={CARD_PAGE_SIZE} params={{ stage: stage !== "todo" ? stage : undefined, q }} />
    </>
  );
}
