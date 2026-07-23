import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, ValidationError } from "@formspree/react";

/** Formspree form id (from https://formspree.io/f/mojgnkoz). Override via Vercel env if needed. */
const FORMSPREE_FORM_ID = (import.meta.env.VITE_FORMSPREE_FORM_ID || "mojgnkoz").trim();

const css = `
.fp-contact {
  min-height: 100vh;
  background: #FAF7F2;
  color: var(--ink);
  font-family: var(--serif);
}
.fp-contact .wrap {
  width: min(1120px, calc(100% - 48px));
  margin: 0 auto;
}
.fp-contact .nav {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(250, 247, 242, .88);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid transparent;
  transition: border-color .2s, background .2s;
}
.fp-contact .nav.scrolled { border-bottom-color: var(--line); background: rgba(250, 247, 242, .96); }
.fp-contact .nav .row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 74px;
}
.fp-contact .logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
  flex-shrink: 0;
}
.fp-contact .logo .word {
  font-family: var(--display);
  font-size: 22px;
  font-weight: 600;
}
.fp-contact .logo .word b { color: var(--terra); }
.fp-contact .navlinks {
  display: flex;
  align-items: center;
  gap: 26px;
}
.fp-contact .navlinks a {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--ink-2);
  text-decoration: none;
  white-space: nowrap;
}
.fp-contact .navlinks a:hover { color: var(--terra); }
.fp-contact .navcta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}
.fp-contact .navcta .signin {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--ink-2);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  white-space: nowrap;
}
.fp-contact .navcta .signin:hover { color: var(--terra); }
.fp-contact .btn {
  font-family: var(--mono);
  text-transform: uppercase;
  letter-spacing: .07em;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: var(--r-sm);
  padding: 15px 26px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  white-space: nowrap;
  transition: transform .12s, box-shadow .22s, background .2s, color .2s;
}
.fp-contact .btn-primary {
  background: var(--terra);
  color: #fff;
  box-shadow: 0 8px 20px rgba(190,90,55,.26);
}
.fp-contact .btn-primary:hover {
  background: var(--terra-d);
  box-shadow: 0 12px 28px rgba(190,90,55,.34);
  transform: translateY(-1px);
}
.fp-contact .btn-block { width: 100%; }
.fp-contact .navmenu-btn {
  display: none;
  background: none;
  border: none;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--ink);
  padding: 0;
}
.fp-contact .navmobile {
  display: none;
  position: fixed;
  inset: 74px 0 0 0;
  z-index: 90;
  background: rgba(42, 37, 29, 0.28);
  backdrop-filter: blur(2px);
}
.fp-contact .navmobile.open { display: block; }
.fp-contact .navmobile-panel {
  background: #FAF7F2;
  width: 100%;
  padding: 8px 0 32px;
  border-bottom: 1px solid var(--line);
  box-shadow: var(--shadow);
}
.fp-contact .navmobile-links {
  display: flex;
  flex-direction: column;
  padding: 8px 24px 16px;
  gap: 4px;
}
.fp-contact .navmobile-links a {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--ink-2);
  text-decoration: none;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}
.fp-contact .navmobile-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 24px 0;
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
  font-style: italic;
  font-weight: 600;
  line-height: 1.25;
  color: #2E2820;
}
.fp-contact-sub {
  margin: 0 auto;
  max-width: 420px;
  font-family: var(--serif);
  font-size: 15px;
  line-height: 1.6;
  color: #6A5A40;
}
.fp-contact-form {
  margin-top: 24px;
  text-align: left;
}
.fp-contact-field { margin-bottom: 16px; }
.fp-contact-label {
  display: block;
  margin-bottom: 7px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #6A5A40;
}
.fp-contact-input,
.fp-contact-textarea {
  width: 100%;
  background: #FAF7F2;
  border: 1px solid #D8CFC0;
  border-radius: 8px;
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
.fp-contact-textarea::placeholder { color: #A09070; }
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
  border-radius: 7px;
  background: #FAE0DA;
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
  border-radius: 8px;
  background: var(--terra);
  color: #fff;
  font-family: var(--serif);
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(190, 90, 55, .24);
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
  font-style: italic;
  font-weight: 600;
  line-height: 1.35;
  color: #2E2820;
}
.fp-contact-or {
  margin-top: 28px;
  padding-top: 22px;
  border-top: 1px solid var(--line);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
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

@media (max-width: 900px) {
  .fp-contact .navlinks,
  .fp-contact .navcta .signin,
  .fp-contact .navcta .btn:not(.navmenu-btn) { display: none; }
  .fp-contact .navmenu-btn { display: inline-flex; }
}
`;

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

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
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onSignIn = () => navigate("/app", { replace: true });
  const onStart = () => navigate("/app?signup=1", { replace: true });

  return (
    <div className="fp-contact">
      <style>{css}</style>

      <header className={"nav" + (scrolled ? " scrolled" : "")}>
        <div className="wrap row">
          <a className="logo" href="/">
            <img src="/uploads/Logo_4.png" alt="FamilyPause" style={{ height: 36, width: 36, borderRadius: 8, display: "block" }} />
            <span className="word"><b>Family</b>Pause</span>
          </a>
          <nav className="navlinks">
            <a href="/#how">How It Works</a>
            <a href="/#who">Who It&apos;s For</a>
            <a href="/#pricing">Pricing</a>
            <a href="/#deck">Card Deck</a>
          </nav>
          <div className="navcta">
            <button type="button" className="signin" onClick={onSignIn}>Sign In</button>
            <button type="button" className="btn btn-primary" onClick={onStart}>Create My Plan</button>
            <button
              type="button"
              className="navmenu-btn"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} strokeWidth={2}>
                {mobileNavOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
        <div className={"navmobile" + (mobileNavOpen ? " open" : "")} onClick={() => setMobileNavOpen(false)}>
          <nav className="navmobile-panel" onClick={(e) => e.stopPropagation()}>
            <div className="navmobile-links">
              <a href="/#how" onClick={() => setMobileNavOpen(false)}>How It Works</a>
              <a href="/#who" onClick={() => setMobileNavOpen(false)}>Who It&apos;s For</a>
              <a href="/#pricing" onClick={() => setMobileNavOpen(false)}>Pricing</a>
              <a href="/#deck" onClick={() => setMobileNavOpen(false)}>Card Deck</a>
              <a href="/blog" onClick={() => setMobileNavOpen(false)}>Blog</a>
            </div>
            <div className="navmobile-actions">
              <button
                type="button"
                className="signin"
                onClick={() => { setMobileNavOpen(false); onSignIn(); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => { setMobileNavOpen(false); onStart(); }}
              >
                Create My Plan
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="fp-contact-main">
        <img className="fp-contact-mark" src="/uploads/Logo_4.png" alt="" />
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
  );
}
