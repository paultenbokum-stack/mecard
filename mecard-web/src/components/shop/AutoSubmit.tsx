"use client";

import { useEffect } from "react";

/** Sends the customer straight on to PayFast, as the WooCommerce gateway's receipt page did. */
export function AutoSubmit({ formId }: { formId: string }) {
  useEffect(() => {
    (document.getElementById(formId) as HTMLFormElement | null)?.submit();
  }, [formId]);
  return null;
}
