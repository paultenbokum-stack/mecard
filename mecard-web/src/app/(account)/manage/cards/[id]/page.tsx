import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CARD_TYPES, Subnav } from "@/components/account/Bits";
import { CardDesigner } from "@/components/account/CardDesigner";
import { canManageCard, viewer } from "@/lib/access";
import { cardForDesign, QR_DEFAULTS } from "@/lib/card-design";
import { requireUserId } from "@/lib/session";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Design your card" };

// Designing one card: custom cards (artwork and QR) and classic cards (logo, name, title).
export default async function CardDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const cardId = Number((await params).id);
  if (!Number.isInteger(cardId) || cardId <= 0) notFound();
  const v = await viewer(await requireUserId(`/manage/cards/${cardId}/`));
  if (!(await canManageCard(v, cardId))) redirect("/manage/cards/?done=denied");
  const data = await cardForDesign(cardId);
  if (!data || data.card.archived) notFound();
  const { card: c, defaults } = data;
  const kind = c.type === "contactcard" ? "custom" : c.type === "classiccard" ? "classic" : null;

  return (
    <div className="acc__wrap acc__wrap--wide">
      <Subnav active="cards" />
      <p className="acc__eyebrow">My Cards</p>
      <h1>{kind ? "Design your card" : CARD_TYPES[c.type] ?? "Card"}</h1>
      <p className="acc__lead">
        {CARD_TYPES[c.type] ?? "Card"} · /t/{c.slug}/ · <Link href="/manage/cards/?tab=new">Back to My Cards</Link>
      </p>
      {kind ? (
        <section className="acc-panel acc-panel--white">
          <CardDesigner
            cardId={c.id}
            kind={kind}
            cardUrl={siteUrl(`/t/${c.slug}/`)}
            locked={c.designReceived}
            submitted={c.designSubmitted}
            custom={{
              frontPath: c.frontPath,
              backPath: c.backPath,
              qrX: Number(c.qrX) || QR_DEFAULTS.x,
              qrY: Number(c.qrY) || QR_DEFAULTS.y,
              qrWidth: Number(c.qrWidth) || QR_DEFAULTS.width,
              qrCodeColour: c.qrCodeColour || QR_DEFAULTS.code,
              qrFillColour: c.qrFillColour || QR_DEFAULTS.fill,
            }}
            classic={{ frontPath: c.frontPath, nameOnCard: c.nameOnCard, jobTitleOnCard: c.jobTitleOnCard }}
            defaults={defaults}
          />
        </section>
      ) : (
        <div className="acc-panel">There&rsquo;s nothing to design on a {CARD_TYPES[c.type]?.toLowerCase() ?? "tag"}: it works as soon as you link it to a profile.</div>
      )}
    </div>
  );
}
