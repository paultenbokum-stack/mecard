"use client";

import { useActionState, useState } from "react";
import { sendContactAction } from "@/app/(site)/actions";

// The Toolset contact-us form, with the same Bootstrap markup and labels.

export function ContactForm() {
  const [state, action, pending] = useActionState(sendContactAction, null);
  const [started] = useState(() => Date.now());
  if (state?.ok)
    return (
      <div className="mc-form-ok" role="status">
        Thank you for getting in touch! We&rsquo;ll get back to you shortly.
      </div>
    );
  return (
    <div className="wp-block-toolset-cred-form">
      <form action={action} className="cred-form cred-keep-original">
        <p>Please fill in your details below and we&apos;ll get back to you shortly!</p>
        {state?.error ? (
          <div className="wpt-top-form-error wpt-form-error alert alert-danger" role="alert">
            {state.error}
          </div>
        ) : null}
        <input type="hidden" name="started" value={started} />
        <div className="mc-hp" aria-hidden="true">
          <label htmlFor="cf-website">Website</label>
          <input type="text" id="cf-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="form-group">
          <label htmlFor="cf-name">Your name</label>
          <input type="text" id="cf-name" name="name" required maxLength={200} autoComplete="name" className="form-control wpt-form-textfield form-textfield textfield" />
        </div>
        <div className="form-group">
          <label htmlFor="cf-email">Your email address</label>
          <input type="email" id="cf-email" name="email" required maxLength={255} autoComplete="email" className="form-control wpt-form-textfield form-textfield textfield" />
        </div>
        <div className="form-group">
          <label htmlFor="cf-phone">Phone Number</label>
          <input type="tel" id="cf-phone" name="phone" maxLength={50} autoComplete="tel" className="form-control wpt-form-textfield form-textfield textfield" />
        </div>
        <div className="form-group">
          <label htmlFor="cf-message">What would you like to know?</label>
          <textarea id="cf-message" name="message" required maxLength={5000} rows={5} placeholder="Please type your query here..." className="form-control wpt-form-textarea form-textarea textarea" />
        </div>
        <div className="form-group">
          <input type="submit" value={pending ? "Sending…" : "Send email"} disabled={pending} className="btn btn-primary btn-lg wpt-form-submit form-submit submit" />
        </div>
      </form>
    </div>
  );
}
