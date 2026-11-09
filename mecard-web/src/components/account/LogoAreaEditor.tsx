"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cleanLogoHeight, cleanLogoWidth, cleanLogoX, cleanLogoY, LOGO_HEIGHT, type LogoFit } from "@/lib/branding";

// Handles drawn over the live preview's logo: click the logo to move it or
// resize it from a corner, or click the area around it and drag its bottom edge.
// It reads where the preview put the logo, so what you drag is what the profile shows.

type Box = { top: number; left: number; width: number; height: number };
type Fit = Pick<LogoFit, "logoWidth" | "logoX" | "logoY" | "logoHeight">;
type Drag = { kind: "move" | "resize" | "height"; dir: 1 | -1; x: number; y: number; fit: Fit; areaW: number; areaH: number };

export function LogoAreaEditor({ fit, onChange }: { fit: Fit; onChange: (fit: Fit) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<{ area: Box; logo: Box | null } | null>(null);
  const [selected, setSelected] = useState<"logo" | "area" | null>(null);
  const drag = useRef<Drag | null>(null);

  const measure = useCallback(() => {
    const scroll = root.current?.parentElement;
    const area = scroll?.querySelector<HTMLElement>(".pro-logo");
    if (!scroll || !area) return setBoxes((prev) => (prev ? null : prev));
    const s = scroll.getBoundingClientRect();
    const rel = (r: DOMRect): Box => ({ top: r.top - s.top + scroll.scrollTop, left: r.left - s.left + scroll.scrollLeft, width: r.width, height: r.height });
    const img = area.querySelector("img");
    const next = { area: rel(area.getBoundingClientRect()), logo: img ? rel(img.getBoundingClientRect()) : null };
    // Only a real change re-renders, or measuring after each render would never stop.
    setBoxes((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  // Measure after every change, and whenever the logo loads or the preview resizes.
  useLayoutEffect(measure);
  useEffect(() => {
    const area = root.current?.parentElement?.querySelector(".pro-logo");
    const img = area?.querySelector("img");
    const ro = new ResizeObserver(measure);
    if (area) ro.observe(area);
    if (img) {
      ro.observe(img);
      img.addEventListener("load", measure);
    }
    return () => {
      ro.disconnect();
      img?.removeEventListener("load", measure);
    };
  }, [measure, fit]);

  // A click elsewhere puts the handles away.
  useEffect(() => {
    if (!selected) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setSelected(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [selected]);

  // The root always renders: it's how the overlay finds the preview to measure.
  if (!boxes) return <div ref={root} className="acc-logoedit" />;
  const { area, logo } = boxes;

  const start = (kind: Drag["kind"], dir: 1 | -1 = 1) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(kind === "height" ? "area" : "logo");
    drag.current = { kind, dir, x: e.clientX, y: e.clientY, fit: { ...fit }, areaW: area.width, areaH: area.height };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.kind === "move") {
      // Moving freezes the area's height, so it doesn't follow the logo around.
      onChange({ ...d.fit, logoX: cleanLogoX(d.fit.logoX + (dx / d.areaW) * 100), logoY: cleanLogoY(d.fit.logoY + dy), logoHeight: d.fit.logoHeight || cleanLogoHeight(d.areaH) });
    } else if (d.kind === "resize") {
      // The logo stays centred on its spot, so a corner moves half as far as the width changes.
      onChange({ ...d.fit, logoWidth: cleanLogoWidth(d.fit.logoWidth + ((dx * d.dir * 2) / d.areaW) * 100) });
    } else {
      onChange({ ...d.fit, logoHeight: cleanLogoHeight((d.fit.logoHeight || d.areaH) + dy) || LOGO_HEIGHT.min });
    }
  };
  const end = () => {
    drag.current = null;
  };

  const nudge = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    const next: Partial<Fit> =
      e.key === "ArrowLeft" ? { logoX: cleanLogoX(fit.logoX - step) }
      : e.key === "ArrowRight" ? { logoX: cleanLogoX(fit.logoX + step) }
      : e.key === "ArrowUp" ? { logoY: cleanLogoY(fit.logoY - step) }
      : e.key === "ArrowDown" ? { logoY: cleanLogoY(fit.logoY + step) }
      : e.key === "+" || e.key === "=" ? { logoWidth: cleanLogoWidth(fit.logoWidth + step) }
      : e.key === "-" ? { logoWidth: cleanLogoWidth(fit.logoWidth - step) }
      : {};
    if (!Object.keys(next).length) return;
    e.preventDefault();
    onChange({ ...fit, ...next, logoHeight: fit.logoHeight || cleanLogoHeight(area.height) });
  };

  const px = (b: Box) => ({ top: b.top, left: b.left, width: b.width, height: b.height });
  return (
    <div ref={root} className="acc-logoedit" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div
        className={`acc-logoedit__area${selected === "area" ? " is-on" : ""}`}
        style={px(area)}
        role="button"
        tabIndex={0}
        aria-label="Logo area. Drag the bottom edge to change its height."
        onPointerDown={(e) => {
          e.stopPropagation();
          setSelected("area");
        }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? -1 : 1);
          onChange({ ...fit, logoHeight: cleanLogoHeight((fit.logoHeight || area.height) + step) || LOGO_HEIGHT.min });
        }}
      >
        {selected === "area" ? <span className="acc-logoedit__edge" onPointerDown={start("height")} aria-hidden="true" /> : null}
      </div>
      {logo ? (
        <div
          className={`acc-logoedit__logo${selected === "logo" ? " is-on" : ""}`}
          style={px(logo)}
          role="button"
          tabIndex={0}
          aria-label="Logo. Drag to move it, or use the arrow keys. Drag a corner, or press + and -, to resize it."
          onPointerDown={start("move")}
          onKeyDown={nudge}
          onFocus={() => setSelected("logo")}
        >
          {selected === "logo"
            ? ([["nw", -1], ["ne", 1], ["sw", -1], ["se", 1]] as const).map(([corner, dir]) => (
                <span key={corner} className={`acc-logoedit__handle acc-logoedit__handle--${corner}`} onPointerDown={start("resize", dir)} aria-hidden="true" />
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
