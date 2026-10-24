"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveDesignAction } from "@/app/(account)/manage/card-actions";
import { imageUrl } from "@/lib/images/paths";
import { ImageLibrary } from "./ImageLibrary";

// The card design screens from the plugin (custom card editor with the
// draggable, resizable QR code; classic card details), on a card drawn at its
// real size (8.56 × 5.4 cm), the frame the stored QR position refers to.

type Custom = { frontPath: string | null; backPath: string | null; qrX: number; qrY: number; qrWidth: number; qrCodeColour: string; qrFillColour: string };
type Classic = { frontPath: string | null; nameOnCard: string; jobTitleOnCard: string };

/** One image slot (logo, front or back): its button and the card preview open the media picker (upload, or reuse from My images). */
function useUpload(title: string, onUploaded: (p: string) => void) {
  const [open, setOpen] = useState(false);
  const picker = open ? <ImageLibrary slot="artwork" title={title} onPick={onUploaded} onClose={() => setOpen(false)} /> : null;
  return { picker, busy: false, open: () => setOpen(true) };
}

type Upload = ReturnType<typeof useUpload>;

function UploadButton({ upload, label }: { upload: Upload; label: string }) {
  return (
    <button type="button" className="acc-btn acc-btn--small" disabled={upload.busy} onClick={upload.open}>
      {upload.busy ? "Uploading…" : label}
    </button>
  );
}

/** Props that make a card preview open its upload: click, tap, Enter or Space (clicks on the QR code don't count). */
function clickToUpload(upload: Upload, label: string, enabled: boolean) {
  if (!enabled) return {};
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    title: label,
    "data-upload": "",
    onClick: (e: React.MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".card-design__qr")) upload.open();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      upload.open();
    },
  } as const;
}

/** The empty slot: WordPress's image placeholder (plugin images/image-placeholder.jpg) and a hint. */
function Placeholder({ hint }: { hint: string }) {
  return (
    <span className="card-design__empty">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/card/image-placeholder.png" alt="" />
      <span>{hint}</span>
    </span>
  );
}

/** The QR code as a data URL in the chosen colours (what will be printed: the card's own address). */
function useQr(url: string, dark: string, light: string) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    void import("qrcode").then((QR) =>
      QR.toDataURL(url, { margin: 0, width: 400, errorCorrectionLevel: "H", color: { dark: `${dark}ff`.slice(0, 9), light: `${light}ff`.slice(0, 9) } }).then((s) => live && setSrc(s)),
    );
    return () => {
      live = false;
    };
  }, [url, dark, light]);
  return src;
}

export function CardDesigner({
  cardId,
  kind,
  cardUrl,
  locked,
  submitted,
  custom,
  classic,
  defaults,
}: {
  cardId: number;
  kind: "custom" | "classic";
  cardUrl: string;
  locked: boolean;
  submitted: boolean;
  custom: Custom;
  classic: Classic;
  defaults: { name: string; jobTitle: string; logo: string | null };
}) {
  const router = useRouter();
  const [c, setC] = useState<Custom>(custom);
  const [k, setK] = useState<Classic>(classic);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, start] = useTransition();
  const qr = useQr(cardUrl, c.qrCodeColour, c.qrFillColour);
  const back = useRef<HTMLDivElement>(null);
  const frontUpload = useUpload("Card front design", (p) => setC((x) => ({ ...x, frontPath: p })));
  const backUpload = useUpload("Card back design", (p) => setC((x) => ({ ...x, backPath: p })));
  const logoUpload = useUpload("Logo on the card", (p) => setK((x) => ({ ...x, frontPath: p })));
  const drag = useRef<{ mode: "move" | "resize"; x: number; y: number; start: Custom } | null>(null);

  // The QR box moves; its corner handle (data-mode="resize") resizes it.
  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    if (locked) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode: e.currentTarget.dataset.mode === "resize" ? "resize" : "move", x: e.clientX, y: e.clientY, start: c };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const frame = back.current?.getBoundingClientRect();
    if (!d || !frame) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.mode === "move") {
      setC((x) => ({
        ...x,
        qrX: Math.round(Math.min(Math.max(0, d.start.qrX + dx), frame.width - x.qrWidth)),
        qrY: Math.round(Math.min(Math.max(0, d.start.qrY + dy), frame.height - x.qrWidth)),
      }));
    } else {
      const max = Math.min(frame.width - d.start.qrX, frame.height - d.start.qrY, 190);
      setC((x) => ({ ...x, qrWidth: Math.round(Math.min(max, Math.max(40, d.start.qrWidth + Math.max(dx, dy)))) }));
    }
  }
  function onPointerUp() {
    drag.current = null;
  }

  const save = (submit: boolean) =>
    start(async () => {
      setError("");
      setNote("");
      // Printing reads the card's own name and title, so blanks take the profile's.
      const data = kind === "custom" ? c : { frontPath: k.frontPath ?? defaults.logo, nameOnCard: k.nameOnCard || defaults.name, jobTitleOnCard: k.jobTitleOnCard || defaults.jobTitle };
      const res = await saveDesignAction(cardId, kind, data, submit);
      if (!res.ok) return setError(res.error);
      setNote(submit ? "Design submitted. We’ll check it and let you know if anything needs changing." : "Saved.");
      router.refresh();
    });

  const art = (p: string | null) => imageUrl(p, 960);
  const logo = k.frontPath ?? defaults.logo;

  return (
    <div className="card-design">
      {frontUpload.picker}
      {backUpload.picker}
      {logoUpload.picker}
      {locked ? <div className="acc-panel acc-panel--notice">This design has been received by MeCard and can no longer be changed.</div> : null}

      {kind === "custom" ? (
        <>
          <p className="acc__muted">You need to provide your own front and back design files in 856 x 540px, PNG or JPG.</p>
          <div className="card-design__grid">
            <div>
              <div className="card-design__label">Card front</div>
              <div className="card-design__card" {...clickToUpload(frontUpload, c.frontPath ? "Click to replace the front design" : "Click to upload the front design", !locked)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.frontPath ? <img src={art(c.frontPath)!} alt="Card front artwork" /> : <Placeholder hint="Click to upload the front design" />}
              </div>
              {!locked ? <UploadButton upload={frontUpload} label={c.frontPath ? "Replace front image" : "Upload front image"} /> : null}
            </div>
            <div>
              <div className="card-design__label">Card back, with the QR code</div>
              <div
                className="card-design__card"
                ref={back}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                {...clickToUpload(backUpload, c.backPath ? "Click to replace the back design" : "Click to upload the back design", !locked)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.backPath ? <img src={art(c.backPath)!} alt="Card back artwork" /> : <Placeholder hint="Click to upload the back design" />}
                <div
                  className={`card-design__qr${locked ? "" : " is-editable"}`}
                  style={{ left: c.qrX, top: c.qrY, width: c.qrWidth, height: c.qrWidth, background: c.qrFillColour }}
                  data-mode="move"
                  onPointerDown={onPointerDown}
                  role="img"
                  aria-label="QR code position"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {qr ? <img src={qr} alt="" draggable={false} /> : null}
                  {!locked ? <span className="card-design__handle" data-mode="resize" onPointerDown={onPointerDown} aria-label="Resize QR code" /> : null}
                </div>
              </div>
              {!locked ? <UploadButton upload={backUpload} label={c.backPath ? "Replace back image" : "Upload back image"} /> : null}
              <p className="acc__muted" style={{ marginTop: 8 }}>
                The QR code is generated automatically. Drag it into place and use the corner handle to resize it.
              </p>
            </div>
          </div>
          <div className="acc-grid" style={{ marginTop: 14 }}>
            <div className="acc-field">
              <label htmlFor="qr-width">QR size</label>
              <input id="qr-width" type="number" min={40} max={190} value={c.qrWidth} disabled={locked} onChange={(e) => setC((x) => ({ ...x, qrWidth: Math.min(190, Math.max(40, Number(e.target.value) || 40)) }))} />
            </div>
            <div className="acc-field">
              <label htmlFor="qr-code">QR code colour</label>
              <div className="acc-colour">
                <input id="qr-code" type="color" value={c.qrCodeColour} disabled={locked} onChange={(e) => setC((x) => ({ ...x, qrCodeColour: e.target.value }))} />
                <span>{c.qrCodeColour}</span>
              </div>
            </div>
            <div className="acc-field">
              <label htmlFor="qr-fill">QR background colour</label>
              <div className="acc-colour">
                <input id="qr-fill" type="color" value={c.qrFillColour} disabled={locked} onChange={(e) => setC((x) => ({ ...x, qrFillColour: e.target.value }))} />
                <span>{c.qrFillColour}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="card-design__grid">
          <div>
            <div className="card-design__label">Classic card front</div>
            <div className="card-design__card card-design__card--classic" {...clickToUpload(logoUpload, logo ? "Click to change your logo" : "Click to upload your logo", !locked)}>
              <div className="card-design__logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {logo ? <img src={imageUrl(logo, 480)!} alt="Logo" /> : <Placeholder hint="Click to upload your logo" />}
              </div>
              <p className="card-design__name">{k.nameOnCard || defaults.name}</p>
              <p className="card-design__title">{k.jobTitleOnCard || defaults.jobTitle}</p>
            </div>
            {!locked ? <UploadButton upload={logoUpload} label={logo ? "Change logo" : "Upload logo"} /> : null}
          </div>
          <div className="acc-form">
            <div className="acc-field">
              <label htmlFor="name-on-card">Name on card</label>
              <input id="name-on-card" type="text" maxLength={255} value={k.nameOnCard} placeholder={defaults.name} disabled={locked} onChange={(e) => setK((x) => ({ ...x, nameOnCard: e.target.value }))} />
            </div>
            <div className="acc-field">
              <label htmlFor="job-on-card">Job title on card</label>
              <input id="job-on-card" type="text" maxLength={255} value={k.jobTitleOnCard} placeholder={defaults.jobTitle} disabled={locked} onChange={(e) => setK((x) => ({ ...x, jobTitleOnCard: e.target.value }))} />
            </div>
            <p className="acc__muted">The back of every classic card is the standard MeCard design with your QR code.</p>
          </div>
        </div>
      )}

      {error ? (
        <p className="acc-error" role="alert">
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="acc-ok" role="status">
          {note}
        </p>
      ) : null}
      {!locked ? (
        <div className="acc-actions">
          <button type="button" className="acc-btn" disabled={busy} onClick={() => save(false)}>
            Save {kind === "custom" ? "custom" : "classic"} card details
          </button>
          <button type="button" className="acc-btn acc-btn--primary" disabled={busy} onClick={() => save(true)}>
            {submitted ? "Resubmit design" : "Submit design"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
