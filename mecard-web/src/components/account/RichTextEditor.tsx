"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeRichHtml } from "@/lib/rich-text";

// The company description editor: WordPress's TinyMCE field (formatselect,
// bold, italic, lists, links) as a small contentEditable with a toolbar, and
// the HTML itself one click away. Pasted HTML is cleaned to the same allowlist
// the server keeps on save.

type Block = "p" | "h2" | "h3" | "h4";
const BLOCKS: [Block, string][] = [
  ["p", "Paragraph"],
  ["h2", "Heading"],
  ["h3", "Subheading"],
  ["h4", "Small heading"],
];

const cmd = (name: string, value?: string) => document.execCommand(name, false, value);

function ToolButton({
  label,
  icon,
  active = false,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  active?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    // mousedown would move the focus (and the selection) out of the text.
    <button
      type="button"
      className="acc-rte__btn"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <i className={`fa-solid ${icon}`} aria-hidden="true" />
    </button>
  );
}

export function RichTextEditor({
  id,
  label,
  value,
  onChange,
  maxLength = 20000,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (html: string) => void;
  maxLength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const range = useRef<Range | null>(null);
  const [source, setSource] = useState(false);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("https://");
  const [state, setState] = useState({ block: "p" as Block, bold: false, italic: false, ul: false, ol: false, link: false });

  // Only write the HTML in when it changed from outside (first render, the HTML view), never while typing.
  // Cleaned first: event handler attributes would run inside the editable area.
  useEffect(() => {
    const el = ref.current;
    if (el && !source && el.innerHTML !== value) el.innerHTML = sanitizeRichHtml(value);
  }, [value, source]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML;
    onChange(html.replace(/^(<br>|<p><br><\/p>)$/, "").slice(0, maxLength));
  };

  const refresh = () => {
    const sel = document.getSelection();
    if (!sel || !ref.current?.contains(sel.anchorNode)) return;
    let n: Node | null = sel.anchorNode;
    let block: Block = "p";
    let link = false;
    while (n && n !== ref.current) {
      if (n instanceof HTMLElement) {
        const t = n.tagName.toLowerCase();
        if (t === "a") link = true;
        if (t === "h2" || t === "h3" || t === "h4") block = t;
      }
      n = n.parentNode;
    }
    setState({
      block,
      link,
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      ul: document.queryCommandState("insertUnorderedList"),
      ol: document.queryCommandState("insertOrderedList"),
    });
  };

  useEffect(() => {
    document.addEventListener("selectionchange", refresh);
    return () => document.removeEventListener("selectionchange", refresh);
  });

  const run = (name: string, v?: string) => {
    ref.current?.focus();
    cmd(name, v);
    emit();
    refresh();
  };

  const startLink = () => {
    const sel = document.getSelection();
    range.current = sel && sel.rangeCount && ref.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    setUrl("https://");
    setLinking(true);
  };
  const addLink = () => {
    const href = url.trim();
    setLinking(false);
    if (!href || href === "https://") return;
    const safe = /^(https?:|mailto:|tel:)/i.test(href) ? href : /^[^\s@]+@[^\s@]+$/.test(href) ? `mailto:${href}` : `https://${href}`;
    ref.current?.focus();
    const sel = document.getSelection();
    if (range.current && sel) {
      sel.removeAllRanges();
      sel.addRange(range.current);
    }
    if (sel && sel.isCollapsed)
      cmd("insertHTML", `<a href="${safe.replace(/"/g, "&quot;")}">${safe.replace(/^mailto:|^tel:|^https?:\/\//i, "").replace(/[<>&]/g, "")}</a>`);
    else cmd("createLink", safe);
    emit();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (!html) return; // plain text pastes as it is
    e.preventDefault();
    // Word and web pages bring classes and inline styles along; keep the structure only.
    cmd("insertHTML", sanitizeRichHtml(html).replace(/\s(class|style)="[^"]*"/g, ""));
    emit();
  };

  return (
    <div className="acc-rte">
      <div className="acc-rte__bar" role="toolbar" aria-label="Formatting" aria-controls={id}>
        <select
          className="acc-rte__block"
          aria-label="Text style"
          value={state.block}
          disabled={source}
          onChange={(e) => run("formatBlock", `<${e.target.value}>`)}
        >
          {BLOCKS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <ToolButton label="Bold" icon="fa-bold" active={state.bold} disabled={source} onClick={() => run("bold")} />
        <ToolButton label="Italic" icon="fa-italic" active={state.italic} disabled={source} onClick={() => run("italic")} />
        <span className="acc-rte__sep" aria-hidden="true" />
        <ToolButton label="Bulleted list" icon="fa-list-ul" active={state.ul} disabled={source} onClick={() => run("insertUnorderedList")} />
        <ToolButton label="Numbered list" icon="fa-list-ol" active={state.ol} disabled={source} onClick={() => run("insertOrderedList")} />
        <span className="acc-rte__sep" aria-hidden="true" />
        <ToolButton label="Add link" icon="fa-link" disabled={source} onClick={startLink} />
        <ToolButton label="Remove link" icon="fa-link-slash" disabled={source} onClick={() => run("unlink")} />
        <ToolButton
          label="Clear formatting"
          icon="fa-text-slash"
          disabled={source}
          onClick={() => {
            run("removeFormat");
            run("formatBlock", "<p>");
          }}
        />
        <button
          type="button"
          className="acc-rte__btn acc-rte__source"
          aria-pressed={source}
          onClick={() => {
            if (source) onChange(sanitizeRichHtml(value));
            setSource((s) => !s);
          }}
        >
          {source ? "Done" : "HTML"}
        </button>
      </div>
      {linking ? (
        <div className="acc-rte__link">
          <input
            type="url"
            inputMode="url"
            aria-label="Link address"
            value={url}
            autoFocus
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              } else if (e.key === "Escape") setLinking(false);
            }}
          />
          <button type="button" className="acc-btn acc-btn--small acc-btn--primary" onClick={addLink}>
            Add link
          </button>
          <button type="button" className="acc-btn acc-btn--small" onClick={() => setLinking(false)}>
            Cancel
          </button>
        </div>
      ) : null}
      {source ? (
        <textarea
          id={id}
          aria-label={`${label} (HTML)`}
          className="acc-code"
          spellCheck={false}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div
          id={id}
          ref={ref}
          className="acc-rte__area"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          onFocus={(e) => {
            cmd("defaultParagraphSeparator", "p");
            // Start an empty editor in a paragraph, so the first line is a <p> like the rest.
            if (!e.currentTarget.innerHTML) {
              e.currentTarget.innerHTML = "<p><br></p>";
              document.getSelection()?.collapse(e.currentTarget.firstChild!, 0);
            }
          }}
          onInput={emit}
          onBlur={emit}
          onPaste={onPaste}
          onKeyUp={refresh}
          onMouseUp={refresh}
        />
      )}
    </div>
  );
}
