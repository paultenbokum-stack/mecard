"use client";

import { useFormStatus } from "react-dom";

/** A submit button that asks first (when `confirm` is set) and shows it is busy. */
export function ConfirmButton({ confirm, className = "acc-btn acc-btn--small", children }: { confirm?: string; className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
