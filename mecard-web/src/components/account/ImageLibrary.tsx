"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The media picker every image field opens (profile photo, company logo, card
// artwork): upload a new image, or reuse one from My images (the account's media
// library, and the company's for its admins). It replaces the WordPress media
// modal, which showed customers their own uploads.

export type ImageSlot = "photo" | "logo" | "artwork";

type Item = { id: number; path: string; title: string; filename: string; shared: boolean; thumb: string | null; width: number | null; height: number | null };

export async function uploadImage(file: File, slot: ImageSlot, companyId?: number): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  if (slot === "artwork") body.append("kind", "artwork");
  if (companyId) body.append("company_id", String(companyId));
  const res = await fetch("/api/upload/", { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
  if (!res.ok || !json.path) throw new Error(json.error || "Upload failed. Please try again.");
  return json.path;
}

const ACCEPT: Record<ImageSlot, string> = { photo: "image/jpeg,image/png,image/webp,image/gif", logo: "image/jpeg,image/png,image/webp,image/gif", artwork: "image/png,image/jpeg" };
const RULES: Record<ImageSlot, string> = {
  photo: "JPG, PNG, WebP or GIF, up to 10 MB.",
  logo: "JPG, PNG, WebP or GIF, up to 10 MB. A PNG with a transparent background works best.",
  artwork: "PNG or JPG, up to 10 MB. Card designs are printed from the original file.",
};

/** The picker dialog. `onPick` gets the chosen image's path; the record keeps it when its form is saved. */
export function ImageLibrary({ slot, title, companyId, onPick, onClose }: { slot: ImageSlot; title: string; companyId?: number; onPick: (path: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [chosen, setChosen] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (search: string, p: number) => {
      const res = await fetch(`/api/media/?${new URLSearchParams({ q: search, page: String(p), slot })}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { rows: Item[]; total: number } | null;
      if (!json) return setError("Your images couldn't be loaded. Please try again.");
      setTotal(json.total);
      setItems((prev) => (p > 1 && prev ? [...prev, ...json.rows] : json.rows));
      setPage(p);
      // Nothing to reuse yet: start on Upload.
      if (p === 1 && !search && !json.total) setTab("upload");
    },
    [slot],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(q, 1), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  // Escape and Tab are handled here first, so a modal underneath (the card editor) stays open.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>(".acc-modal__close")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      e.stopPropagation();
      const els = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([type="file"]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const [first, last] = [els[0], els[els.length - 1]];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      before?.focus?.();
    };
  }, [onClose]);

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      onPick(await uploadImage(f, slot, companyId));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  };
  const use = (it: Item | null) => {
    if (!it) return;
    onPick(it.path);
    onClose();
  };

  return (
    <div className="acc-modal acc-library">
      <div className="acc-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={panel} className="acc-modal__panel acc-modal__panel--wide" role="dialog" aria-modal="true" aria-labelledby="acc-library-title">
        <div className="acc-modal__head">
          <h2 id="acc-library-title">{title}</h2>
          <button type="button" className="acc-modal__close" aria-label="Close" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className="acc-modal__body">
          <div className="acc-library__tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "library"} onClick={() => setTab("library")}>
              My images{items ? ` (${total})` : ""}
            </button>
            <button type="button" role="tab" aria-selected={tab === "upload"} onClick={() => setTab("upload")}>
              Upload
            </button>
          </div>
          <input ref={file} type="file" accept={ACCEPT[slot]} hidden onChange={(e) => void upload(e.target.files?.[0])} />
          {error ? (
            <p className="acc-error" role="alert">
              {error}
            </p>
          ) : null}

          {tab === "upload" ? (
            <div
              className={`acc-library__drop${dragging ? " is-dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void upload(e.dataTransfer.files?.[0]);
              }}
            >
              <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" />
              <p>
                <strong>Drag an image here</strong> or
              </p>
              <button type="button" className="acc-btn acc-btn--primary" disabled={busy} onClick={() => file.current?.click()}>
                {busy ? "Uploading…" : "Choose a file"}
              </button>
              <p className="acc__muted">{RULES[slot]} It&rsquo;s saved to My images so you can use it again.</p>
            </div>
          ) : (
            <>
              <div className="acc-toolbar">
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by file name or title" aria-label="Search my images" />
              </div>
              {slot === "artwork" ? <p className="acc__muted">Only PNG and JPG images can go on a card, so other images aren&rsquo;t listed.</p> : null}
              {!items ? (
                <p className="acc__muted">Loading your images…</p>
              ) : !items.length ? (
                <div className="acc-empty">
                  {q ? "No images match your search." : "You haven't uploaded any images yet."}{" "}
                  <button type="button" className="acc-link" onClick={() => setTab("upload")}>
                    Upload one
                  </button>
                </div>
              ) : (
                <ul className="acc-library__grid">
                  {items.map((it) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        className="acc-library__tile"
                        aria-pressed={chosen?.id === it.id}
                        onClick={() => setChosen(it)}
                        onDoubleClick={() => use(it)}
                        title={it.filename}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {it.thumb ? <img src={it.thumb} alt="" loading="lazy" /> : <span className="acc-library__archived"><i className="fa-regular fa-image" aria-hidden="true" /><span className="acc-badge acc-badge--off">Archived</span></span>}
                        <span className="acc-library__name">{it.title || it.filename}</span>
                        {it.shared ? <span className="acc-library__shared">Company</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {items && items.length < total ? (
                <div className="acc-more">
                  <button type="button" className="acc-btn acc-btn--small" onClick={() => void load(q, page + 1)}>
                    Show more
                  </button>
                </div>
              ) : null}
              <div className="acc-library__foot">
                <span className="acc__muted">{chosen ? (chosen.thumb ? chosen.filename : `${chosen.filename}: archived, it's brought back when you use it.`) : "Select an image, then Use image."}</span>
                <button type="button" className="acc-btn acc-btn--primary" disabled={!chosen} onClick={() => use(chosen)}>
                  Use image
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
