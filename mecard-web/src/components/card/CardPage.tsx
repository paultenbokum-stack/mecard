import { designCss } from "@/lib/branding";
import { displayName, isPro, type ProfileView } from "@/lib/public-profile";
import { CardBehaviour, type CardConfig } from "./CardBehaviour";
import { ProProfile } from "./ProProfile";
import { SharePanel } from "./SharePanel";
import { SiteFooter, SiteHeader } from "./SiteChrome";
import { StandardProfile } from "./StandardProfile";
import { VcardBar } from "./VcardBar";
import { PostSaveCta, WatermarkStrip } from "./Viral";

// One card page, as single-t.php / single-mecard-profile.php rendered it.

export interface CardContext {
  type: "tag" | "profile";
  id: number;
  tagType: string | null;
  pageUrl: string;
  autoDownload: boolean;
}

export function CardPage({ view, context }: { view: ProfileView; context: CardContext }) {
  const { profile: p, company: c } = view;
  const pro = isPro(p);
  const name = displayName(p);
  const config: CardConfig = {
    contextType: context.type,
    contextId: context.id,
    tagType: context.tagType,
    profileId: p.id,
    profileSlug: p.slug,
    profileType: pro ? "professional" : "standard",
    companyId: c?.id ?? null,
    pageUrl: context.pageUrl,
    isFree: !pro,
    ownerName: name,
    vcardName: name,
    autoDownload: context.autoDownload,
  };

  return (
    <>
      {pro ? null : <SiteHeader />}
      <main id="content">
        {/* Branding only applies to pro profiles: on standard ones it turned the
            save button black-on-black (see single-mecard-profile.php). */}
        {pro && c ? <style dangerouslySetInnerHTML={{ __html: designCss(p.id, c) }} /> : null}
        <div className="mc-card-container">
          <div className="mecard-public-card">
            {pro ? (
              <ProProfile view={view}>
                <SharePanel />
                <VcardBar profileId={p.id} name={name} />
              </ProProfile>
            ) : (
              <StandardProfile view={view}>
                <VcardBar profileId={p.id} name={name} />
                <SharePanel />
                <WatermarkStrip />
              </StandardProfile>
            )}
          </div>
        </div>
        {pro ? null : <PostSaveCta profileId={p.id} />}
      </main>
      <SiteFooter />
      <CardBehaviour config={config} />
    </>
  );
}
