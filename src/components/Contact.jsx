import { useState } from "react";
import { useForm, ValidationError } from "@formspree/react";
import MarketingChrome from "./MarketingChrome.jsx";

/** Formspree form id (from https://formspree.io/f/mojgnkoz). Override via Vercel env if needed. */
const FORMSPREE_FORM_ID = (import.meta.env.VITE_FORMSPREE_FORM_ID || "mojgnkoz").trim();

const css = `
.fp-contact {
  background: #FFFFFF;
  color: var(--ink);
  font-family: var(--serif);
  font-weight: 400;
}
.fp-contact-main {
  max-width: 560px;
  margin: 0 auto;
  padding: 56px 24px 96px;
  text-align: center;
}
.fp-contact-mark {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  display: block;
  margin: 0 auto 18px;
}
.fp-contact-title {
  margin: 0 0 12px;
  font-family: var(--display);
  font-size: 32px;
  font-style: normal;
  font-weight: 800;
  line-height: 1.25;
  color: #0F172A;
}
.fp-contact-sub {
  margin: 0 auto;
  max-width: 420px;
  font-family: var(--serif);
  font-size: 15px;
  line-height: 1.6;
  color: #475569;
}
.fp-contact-form {
  margin-top: 24px;
  text-align: left;
}
.fp-contact-field { margin-bottom: 16px; }
.fp-contact-label {
  display: block;
  margin-bottom: 7px;
  font-family: var(--mono); font-weight: 600;
  font-size: 13px;
  letter-spacing: 0;
  color: #475569;
}
.fp-contact-input,
.fp-contact-textarea {
  width: 100%;
  background: #FFFFFF;
  border: 1.5px solid #E5E7EB;
  border-radius: 14px;
  color: var(--ink);
  padding: 13px 16px;
  font: 16px var(--serif);
  outline: none;
  transition: border-color .2s, box-shadow .2s;
}
.fp-contact-textarea {
  min-height: 120px;
  resize: vertical;
  line-height: 1.5;
}
.fp-contact-input::placeholder,
.fp-contact-textarea::placeholder { color: #94A3B8; }
.fp-contact-input:focus,
.fp-contact-textarea:focus {
  border-color: var(--terra);
  box-shadow: 0 0 0 3px var(--terra-tint);
}
.fp-contact-input[aria-invalid="true"],
.fp-contact-textarea[aria-invalid="true"] { border-color: var(--red); }
.fp-contact-error {
  display: block;
  margin: 8px 0 0;
  padding: 9px 11px;
  border-radius: 10px;
  background: var(--red-tint);
  color: var(--red);
  font: 13px/1.4 var(--serif);
}
.fp-contact-field .fp-contact-error { margin-bottom: 0; }
.fp-contact-form > .fp-contact-error { margin: 0 0 12px; }
.fp-contact-submit {
  width: 100%;
  margin-top: 8px;
  min-height: 52px;
  border: none;
  border-radius: 9999px;
  background: var(--terra);
  color: #fff;
  font-family: var(--serif);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(20,128,94, .24);
  transition: background .2s, transform .12s;
}
.fp-contact-submit:hover:not(:disabled) {
  background: var(--terra-d);
  transform: translateY(-1px);
}
.fp-contact-submit:disabled { opacity: .65; cursor: not-allowed; }
.fp-contact-success {
  margin-top: 24px;
  padding: 36px 16px;
  text-align: center;
}
.fp-contact-check {
  width: 34px;
  height: 34px;
  margin: 0 auto 16px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--olive-tint);
  color: var(--olive);
  font-size: 18px;
  font-weight: 600;
}
.fp-contact-success p {
  margin: 0;
  font-family: var(--display);
  font-size: 18px;
  font-style: normal;
  font-weight: 800;
  line-height: 1.35;
  color: #0F172A;
}
.fp-contact-or {
  margin-top: 28px;
  padding-top: 22px;
  border-top: 1px solid var(--line);
  font-family: var(--mono); font-weight: 600;
  font-size: 12px;
  letter-spacing: 0;
  color: var(--ink-3);
  text-align: center;
  line-height: 1.6;
}
.fp-contact-or a {
  color: var(--terra);
  text-decoration: none;
  text-transform: none;
  letter-spacing: .04em;
}
.fp-contact-or a:hover { text-decoration: underline; }
`;

function ContactForm() {
  const [state, handleSubmit] = useForm(FORMSPREE_FORM_ID);
  const [localError, setLocalError] = useState("");

  if (state.succeeded) {
    return (
      <div className="fp-contact-success">
        <div className="fp-contact-check" aria-hidden="true">✓</div>
        <p>Message sent. We&apos;ll be in touch soon.</p>
      </div>
    );
  }

  const onSubmit = (event) => {
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") || "").trim();
    const email = String(new FormData(form).get("email") || "").trim();

    if (!name || !email) {
      event.preventDefault();
      setLocalError("Name and email are required.");
      return;
    }

    setLocalError("");
    handleSubmit(event);
  };

  return (
    <form className="fp-contact-form" onSubmit={onSubmit} noValidate>
      <div className="fp-contact-field">
        <label className="fp-contact-label" htmlFor="contact-name">
          Name <span aria-hidden="true">*</span>
        </label>
        <input
          id="contact-name"
          className="fp-contact-input"
          type="text"
          name="name"
          autoComplete="name"
          required
          aria-required="true"
          disabled={state.submitting}
          onChange={() => { if (localError) setLocalError(""); }}
        />
        <ValidationError prefix="Name" field="name" errors={state.errors} className="fp-contact-error" />
      </div>
      <div className="fp-contact-field">
        <label className="fp-contact-label" htmlFor="contact-email">
          Email <span aria-hidden="true">*</span>
        </label>
        <input
          id="contact-email"
          className="fp-contact-input"
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          required
          aria-required="true"
          disabled={state.submitting}
          onChange={() => { if (localError) setLocalError(""); }}
        />
        <ValidationError prefix="Email" field="email" errors={state.errors} className="fp-contact-error" />
      </div>
      <div className="fp-contact-field">
        <label className="fp-contact-label" htmlFor="contact-message">Message</label>
        <textarea
          id="contact-message"
          className="fp-contact-textarea"
          name="message"
          disabled={state.submitting}
        />
        <ValidationError prefix="Message" field="message" errors={state.errors} className="fp-contact-error" />
      </div>
      {localError && (
        <p className="fp-contact-error" role="alert">{localError}</p>
      )}
      <ValidationError errors={state.errors} className="fp-contact-error" />
      <button
        type="submit"
        className="fp-contact-submit"
        disabled={state.submitting}
      >
        {state.submitting ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}

export default function Contact() {
  return (
    <MarketingChrome>
    <div className="fp-contact">
      <style>{css}</style>
      <main className="fp-contact-main">
        <img className="fp-contact-mark" src="/fp-mark.svg" alt="" />
        <h1 className="fp-contact-title">We&apos;d love to hear from you.</h1>
        <p className="fp-contact-sub">
          Whether you have a question, a bug to report, or just want to say hello, we read every message.
        </p>

        <ContactForm />

        <p className="fp-contact-or">
          Or email us directly at{" "}
          <a href="mailto:hello@familypause.com">hello@familypause.com</a>
        </p>
      </main>
    </div>
    </MarketingChrome>
  );
}
