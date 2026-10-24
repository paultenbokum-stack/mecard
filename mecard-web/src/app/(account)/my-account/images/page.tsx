import type { Metadata } from "next";
import Link from "next/link";
import { AccountLayout } from "@/components/account/AccountNav";
import { Pager } from "@/components/account/Bits";
import { imageUrl } from "@/lib/images/paths";
import { listLibrary, MEDIA_PAGE_SIZE, mediaUsage } from "@/lib/media-library";
import { USAGE_LABEL, type Usage } from "@/lib/media-rules";
import { formatDate } from "@/lib/money";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "My images - MeCard" } };

// My Account → My images: every image in the account's media library (and the
// company's, for its admins), and where each one is used. Images still only in
// the archive bucket show without a thumbnail, so browsing never restores one.
// Deleting unused images and adjusting images will come here.

const usageLink = (u: Usage) => (u.kind.startsWith("card") ? `/manage/cards/${u.id}/` : u.kind === "company-logo" ? `/manage/company/${u.id}/` : `/manage/profile/${u.id}/`);

export default async function MyImagesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const userId = await requireUserId("/my-account/images/");
  const sp = await searchParams;
  const list = await listLibrary(userId, { q: sp.q, page: Number(sp.page) || 1 });
  const usage = await mediaUsage(userId, list.rows.map((r) => r.path));

  return (
    <AccountLayout active="images">
      <h1>My images</h1>
      <p className="acc__lead">The photos, logos and card designs you&rsquo;ve uploaded. Choose any of them again from the image picker in the profile, company and card editors.</p>
      <form className="acc-toolbar" action="/my-account/images/">
        <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Search by file name or title" aria-label="Search my images" />
        <button className="acc-btn" type="submit">
          Search
        </button>
        {sp.q ? (
          <Link className="acc-btn" href="/my-account/images/">
            Clear
          </Link>
        ) : null}
      </form>
      {list.rows.length ? (
        <ul className="acc-images">
          {list.rows.map((r) => {
            const uses = usage.get(r.path) ?? [];
            const thumb = r.active ? imageUrl(r.path, 320) : null;
            return (
              <li className="acc-images__item" key={r.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumb ? <img className="acc-images__img" src={thumb} alt="" loading="lazy" /> : (
                  <span className="acc-images__img acc-library__archived" title="Kept in the archive. It's brought back when you use it.">
                    <i className="fa-regular fa-image" aria-hidden="true" />
                    <span className="acc-badge acc-badge--off">Archived</span>
                  </span>
                )}
                <div className="acc-images__text">
                  <div className="acc-item__title">{r.title || r.filename}</div>
                  <div className="acc-item__sub">
                    {[r.filename !== r.title ? r.filename : "", r.width && r.height ? `${r.width} × ${r.height}` : "", formatDate(r.createdAt), r.ownerId !== userId ? "Company image" : ""].filter(Boolean).join(" · ")}
                  </div>
                  <div className="acc-images__uses">
                    {uses.length ? (
                      <>
                        Used on{" "}
                        {uses.map((u, i) => (
                          <span key={`${u.kind}-${u.id}`}>
                            {i ? ", " : ""}
                            <Link href={usageLink(u)}>
                              {USAGE_LABEL[u.kind].toLowerCase()} · {u.name || `#${u.id}`}
                            </Link>
                          </span>
                        ))}
                      </>
                    ) : (
                      <span className="acc__muted">Not used</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="acc-empty">{sp.q ? "No images match your search." : "You haven't uploaded any images yet. Upload one from a profile, company or card."}</div>
      )}
      <Pager page={list.page} total={list.total} size={MEDIA_PAGE_SIZE} href={(n) => `/my-account/images/?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(n) })}`} />
    </AccountLayout>
  );
}
