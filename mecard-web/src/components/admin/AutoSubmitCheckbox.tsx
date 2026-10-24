"use client";

import { useFormStatus } from "react-dom";

/** A checkbox that saves as soon as it changes (Card Processing submitted its flags on change). */
export function AutoSubmitCheckbox({ name, checked, label }: { name: string; checked: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <input
      type="checkbox"
      name={name}
      defaultChecked={checked}
      disabled={pending}
      aria-label={label}
      title={label}
      className="adm-check"
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    />
  );
}
