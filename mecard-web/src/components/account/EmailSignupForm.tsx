"use client";

import { useActionState, useState } from "react";
import { emailSignupAction } from "@/app/(account)/sign-up/actions";
import type { SignupFor } from "@/lib/signup-choice";

export function EmailSignupForm({ forWhom }: { forWhom: SignupFor }) {
  const [state, action, pending] = useActionState(emailSignupAction, null);
  const [started] = useState(() => Date.now());
  const v = state?.values ?? {};
  return (
    <>
      {state?.errors?.length ? (
        <div className="me-auth-error" role="alert">
          <ul>
            {state.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <form className="me-auth-form" action={action} id="me-signup-form" key={JSON.stringify(v)}>
        <label>
          First name
          <input type="text" name="first_name" defaultValue={v.first_name} autoComplete="given-name" required maxLength={100} />
        </label>
        <label>
          Last name
          <input type="text" name="last_name" defaultValue={v.last_name} autoComplete="family-name" required maxLength={100} />
        </label>
        <label>
          Email address
          <input type="email" name="email" defaultValue={v.email} autoComplete="email" required maxLength={255} />
        </label>
        <label>
          Mobile number
          <input type="tel" name="mobile" defaultValue={v.mobile} autoComplete="tel" required maxLength={50} />
        </label>
        <label>
          Password <span className="me-step__optional">to log back in later</span>
          <input type="password" name="password" autoComplete="new-password" minLength={8} required />
        </label>
        <input type="text" name="website" defaultValue="" autoComplete="off" tabIndex={-1} aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
        <input type="hidden" name="started" value={started} />
        <input type="hidden" name="for" value={forWhom} />
        <button className="me-auth-form__submit" type="submit" disabled={pending}>
          {forWhom === "teams" ? (pending ? "Creating your account…" : "Create my team account") : pending ? "Creating your profile…" : "Create my free profile"}
        </button>
      </form>
    </>
  );
}
