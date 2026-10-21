"use client";

import { useFormStatus } from "react-dom";

/** A submit button that shows it is busy, and asks first when `confirm` is set. */
export function SubmitButton({
  children,
  busy,
  confirm,
  className = "adm-btn",
  name,
  value,
}: {
  children: React.ReactNode;
  busy?: string;
  confirm?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      name={name}
      value={value}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && busy ? busy : children}
    </button>
  );
}
