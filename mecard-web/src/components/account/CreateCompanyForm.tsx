"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCompanyAction } from "@/app/(account)/manage/actions";

// Create a company on Companies, then open its editor in the modal over the
// list (a server-side redirect would open the full page instead).

export function CreateCompanyForm({ label }: { label: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="acc-inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        const name = String(new FormData(e.currentTarget).get("name") ?? "");
        start(async () => {
          const res = await createCompanyAction(name);
          if (!res.ok) return setError(res.error);
          setError("");
          router.push(`/manage/company/${res.id}/?done=company-created`, { scroll: false });
          router.refresh();
        });
      }}
    >
      <input type="text" name="name" required maxLength={255} placeholder="Company name" aria-label="Company name" />
      <button type="submit" className="acc-btn acc-btn--primary" disabled={pending}>
        {label}
      </button>
      {error ? (
        <p className="acc-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
