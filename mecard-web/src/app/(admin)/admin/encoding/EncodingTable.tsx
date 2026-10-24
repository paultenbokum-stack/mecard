"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

// The Encoding file batch with a tick per card: only the ticked cards go into
// the encoding CSV, print CSV and images zip (?id=…). Filters narrow the list;
// cards hidden by a filter are left out of the files even if ticked.

export type EncodingTableRow = { id: number; type: string; typeLabel: string; order: number | null; company: string; encode: boolean; print: boolean; images: string[]; cells: string[] };

export function EncodingTable({ rows, headings }: { rows: EncodingTableRow[]; headings: string[] }) {
  const [ticked, setTicked] = useState<Set<number>>(() => new Set());
  const [order, setOrder] = useState("");
  const [company, setCompany] = useState("");
  const [type, setType] = useState("");

  const companies = useMemo(() => [...new Set(rows.map((r) => r.company).filter(Boolean))].sort(), [rows]);
  const types = useMemo(() => [...new Map(rows.map((r) => [r.type, r.typeLabel])).entries()], [rows]);
  const shown = rows.filter((r) => (!order || String(r.order ?? "").includes(order.trim())) && (!company || r.company === company) && (!type || r.type === type));
  const chosen = shown.filter((r) => ticked.has(r.id));
  const encode = chosen.filter((r) => r.encode).length;
  const print = chosen.filter((r) => r.print).length;
  const images = new Set(chosen.flatMap((r) => r.images)).size;
  const href = (file: string) => `/admin/encoding/${file}?${new URLSearchParams(chosen.map((r) => ["id", String(r.id)]))}`;

  const set = (ids: number[], on: boolean) =>
    setTicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const allShown = shown.length > 0 && chosen.length === shown.length;

  const button = (file: string, label: string, icon: string, n: number, primary = false) =>
    n ? (
      <a href={href(file)} className={`adm-btn${primary ? " adm-btn--primary" : ""}`} download>
        <i className={`fas ${icon}`} aria-hidden="true" /> {label} ({n})
      </a>
    ) : (
      <button type="button" className={`adm-btn${primary ? " adm-btn--primary" : ""}`} disabled>
        <i className={`fas ${icon}`} aria-hidden="true" /> {label} (0)
      </button>
    );

  return (
    <>
      <div className="adm-filters">
        <label>
          Order <input className="adm-input adm-input--sm" type="search" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="Order number" />
        </label>
        <label>
          Company{" "}
          <select className="adm-select" value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">All</option>
            {companies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Type{" "}
          <select className="adm-select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All</option>
            {types.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="adm-head__actions" style={{ alignItems: "center" }}>
        <button type="button" className="adm-btn" onClick={() => set(shown.map((r) => r.id), true)}>
          Select all{shown.length !== rows.length ? " shown" : ""}
        </button>
        <button type="button" className="adm-btn" onClick={() => setTicked(new Set())}>
          Select none
        </button>
        <span className="adm-small" role="status">
          {chosen.length} of {shown.length} selected
        </span>
      </div>
      <div className="adm-head__actions">
        {button("encoding.csv", "Encoding CSV", "fa-file-csv", encode, true)}
        {button("print.csv", "Print CSV", "fa-print", print)}
        {button("images.zip", "Download images", "fa-file-archive", images)}
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table adm-table--tight">
          <thead>
            <tr>
              <th>
                <input type="checkbox" className="adm-check" aria-label="Select all shown cards" checked={allShown} onChange={(e) => set(shown.map((r) => r.id), e.target.checked)} />
              </th>
              <th>Type</th>
              <th>Order</th>
              {headings.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>
                  <input type="checkbox" className="adm-check" aria-label={`Select card ${r.id}`} checked={ticked.has(r.id)} onChange={(e) => set([r.id], e.target.checked)} />
                </td>
                <td className="adm-small">
                  <Link href={`/admin/cards/${r.id}/`}>{r.typeLabel}</Link>
                </td>
                <td className="adm-small">{r.order ? <Link href={`/admin/orders/${r.order}/`}>#{r.order}</Link> : "—"}</td>
                {r.cells.map((v, i) => (
                  <td key={i} className="adm-small">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
            {!shown.length ? (
              <tr>
                <td colSpan={headings.length + 3} className="adm-muted">
                  {rows.length ? "No cards match these filters." : "Nothing to encode or print."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
