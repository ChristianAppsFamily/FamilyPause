import { useEffect, useState } from "react";
import MarketingChrome from "./MarketingChrome.jsx";
import Seo from "./Seo.jsx";
import { isValidEmail, joinWaitlist } from "../lib/sendGuide";

const css = `
.fp-mobile-page {
  background: linear-gradient(135deg, var(--olive), #525E2F);
  color: #fff;
  padding: 88px 0 96px;
  min-height: calc(100vh - 220px);
}
.fp-mobile-page .wrap {
  width: min(760px, calc(100% - 48px));
  margin: 0 auto;
}
.fp-mobile-page .eyebrow {
  font-family: var(--mono);
  text-transform: uppercase;
  letter-spacing: .24em;
  font-size: 12px;
  font-weight: 500;
  color: #F2E7C9;
  display: inline-block;
  margin-bottom: 16px;
}
.fp-mobile-page h1 {
  font-family: var(--display);
  font-weight: 600;
  font-size: clamp(32px, 6vw, 50px);
  line-height: 1.12;
  letter-spacing: -.012em;
  color: #fff;
  margin: 0 0 18px;
}
.fp-mobile-page h1 em {
  color: #F2E7C9;
  font-style: italic;
}
.fp-mobile-page .sub {
  font-family: var(--serif);
  font-size: 18.5px;
  line-height: 1.6;
  color: rgba(255,255,255,.9);
  margin: 0 0 28px;
  max-width: 560px;
}
.fp-mobile-page .chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.fp-mobile-page .chip {
  display: inline-flex;
  align-items: center;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #2A251D;
  background: #FBF6EC;
  border: 1px solid #E6D9C4;
  border-radius: 999px;
  padding: 12px 20px;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(42, 37, 29, .16);
  transition: transform .12s, box-shadow .2s, background .2s, color .2s;
}
.fp-mobile-page .chip:hover {
  color: #2A251D;
  background: #F4EAD8;
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(42, 37, 29, .2);
}
.fp-mobile-page .chip:active { transform: translateY(1px); }

.fp-mobile-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(46, 40, 32, .46);
  backdrop-filter: blur(3px);
}
.fp-mobile-modal {
  position: relative;
  width: 100%;
  max-width: 420px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(70, 45, 20, .26);
  padding: 48px 40px 28px;
  text-align: center;
}
.fp-mobile-modal .eyebrow {
  color: var(--terra);
  margin-bottom: 10px;
}
.fp-mobile-modal h2 {
  font-family: var(--display);
  font-size: 32px;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 12px;
}
.fp-mobile-modal .subline {
  font-family: var(--serif);
  font-size: 16px;
  line-height: 1.55;
  color: var(--ink-2);
  margin: 0 0 22px;
}
.fp-mobile-modal input {
  width: 100%;
  font-family: var(--serif);
  font-size: 16px;
  padding: 14px 16px;
  border: 1px solid var(--line-2);
  border-radius: 8px;
  margin-bottom: 12px;
  background: var(--paper);
  color: var(--ink);
}
.fp-mobile-modal .error {
  color: var(--red);
  font-size: 14px;
  margin: 0 0 12px;
}
.fp-mobile-modal .btn {
  font-family: var(--serif);
  text-transform: none;
  letter-spacing: 0;
  font-size: 15px;
  font-weight: 500;
  border: none;
  border-radius: var(--r-sm);
  padding: 15px 26px;
  cursor: pointer;
  width: 100%;
  background: var(--terra);
  color: #fff;
}
.fp-mobile-modal .btn:disabled { opacity: .7; cursor: wait; }
.fp-mobile-modal .close {
  position: absolute;
  top: 14px;
  right: 14px;
  background: none;
  border: none;
  font-size: 22px;
  line-height: 1;
  color: var(--ink-3);
  cursor: pointer;
}
@media (max-width: 560px) {
  .fp-mobile-page { padding: 64px 0 72px; }
  .fp-mobile-page .wrap { width: min(100%, calc(100% - 44px)); }
  .fp-mobile-modal { padding: 44px 22px 24px; }
}
`;

export default function Mobile() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success

  useEffect(() => {
    if (!waitlistOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setWaitlistOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [waitlistOpen]);

  const openWaitlist = () => {
    setEmail("");
    setError("");
    setStatus("idle");
    setWaitlistOpen(true);
  };

  const submitWaitlist = async (event) => {
    event.preventDefault();
    if (status === "loading") return;
    const nextEmail = email.trim().toLowerCase();
    if (!isValidEmail(nextEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setStatus("loading");
    const result = await joinWaitlist({ email: nextEmail, kind: "mobile-app-waitlist" });
    if (!result.ok) {
      setStatus("idle");
      setError(result.error);
      return;
    }
    setStatus(result.alreadyOnList ? "already" : "success");
  };

  return (
    <MarketingChrome>
      <Seo
        title="Mobile Apps — FamilyPause"
        description="FamilyPause is coming to iOS and Android. Same weekly plan, same calendar sync. Join the waitlist."
        canonical="https://familypause.com/mobile"
        ogTitle="Mobile Apps — FamilyPause"
        ogDescription="FamilyPause is coming to iOS and Android. Same weekly plan, same calendar sync. Join the waitlist."
        ogUrl="https://familypause.com/mobile"
      />
      <style>{css}</style>
      <main className="fp-mobile-page">
        <div className="wrap">
          <span className="eyebrow">Mobile Apps</span>
          <h1>Android and iOS apps.<br /><em>Coming soon.</em></h1>
          <p className="sub">
            FamilyPause is coming to your pocket soon. Same weekly plan, same calendar sync.
            Until then, you can use your mobile browser to plan out your week from anywhere.
          </p>
          <div className="chips">
            <button type="button" className="chip" onClick={openWaitlist}>
              iOS · Coming soon
            </button>
            <button type="button" className="chip" onClick={openWaitlist}>
              Android · Coming soon
            </button>
          </div>
        </div>
      </main>

      {waitlistOpen && (
        <div className="fp-mobile-backdrop" onMouseDown={() => setWaitlistOpen(false)}>
          <div
            className="fp-mobile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-waitlist-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="close" aria-label="Close" onClick={() => setWaitlistOpen(false)}>
              ×
            </button>
            {status === "success" || status === "already" ? (
              <>
                <span className="eyebrow">You&apos;re on the list</span>
                <h2 id="mobile-waitlist-title">
                  {status === "already" ? "You're already on the list" : "We'll let you know"}
                </h2>
                <p className="subline">
                  {status === "already"
                    ? "Thanks — you're already on this waitlist. We'll email you when FamilyPause is ready on the App Store and Google Play."
                    : "Thanks for joining. We'll email you when FamilyPause is ready on the App Store and Google Play."}
                </p>
                <button type="button" className="btn" onClick={() => setWaitlistOpen(false)}>
                  Done
                </button>
              </>
            ) : (
              <form onSubmit={submitWaitlist} noValidate aria-busy={status === "loading"}>
                <span className="eyebrow">Mobile Apps</span>
                <h2 id="mobile-waitlist-title">Join the waitlist</h2>
                <p className="subline">
                  Be first to know when FamilyPause is on the App Store and Google Play. Same weekly plan, same calendar sync, on the phone in your pocket.
                </p>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  required
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError("");
                  }}
                  aria-label="Email address"
                  disabled={status === "loading"}
                />
                {error && <p className="error" role="alert">{error}</p>}
                <button type="submit" className="btn" disabled={status === "loading"}>
                  {status === "loading" ? "Joining..." : "Join the Waitlist"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </MarketingChrome>
  );
}
