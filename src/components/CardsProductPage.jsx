import { useState } from "react";
import { Link } from "react-router-dom";
import { cardsPath } from "../lib/routes";
import { formatDigitalPrice } from "../lib/deckPricing";
import { supabase } from "../lib/supabase";

const css = `
.cards-product {
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--serif);
}
.cards-product .wrap { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }
.cards-product h1 {
  font-family: var(--display);
  font-size: clamp(36px, 5vw, 48px);
  font-weight: 600;
  line-height: 1.08;
  margin: 12px 0 16px;
}
.cards-product h1 em { font-style: italic; color: var(--terra); }
.cards-product .lead { color: var(--ink-2); font-size: 17px; line-height: 1.6; margin-bottom: 32px; }
.cards-product .grid { display: grid; gap: 18px; margin-bottom: 28px; }
.cards-product .card {
  background: var(--paper-card);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 26px 24px;
  box-shadow: var(--shadow-sm);
}
.cards-product .card.feat {
  border-color: var(--terra);
  background: linear-gradient(150deg, #fff, var(--terra-tint));
}
.cards-product .card h2 {
  font-family: var(--display);
  font-size: 26px;
  margin: 0 0 8px;
}
.cards-product .price {
  font-family: var(--display);
  font-size: 36px;
  color: var(--terra);
  margin-bottom: 12px;
}
.cards-product .coming {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--terra-d);
  background: var(--terra-soft);
  display: inline-block;
  border-radius: 999px;
  padding: 6px 12px;
  margin-bottom: 12px;
}
.cards-product ul { margin: 0 0 20px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.cards-product li { font-size: 15px; color: var(--ink); }
.cards-product li::before { content: "→ "; color: var(--olive-d); }
.cards-product .btn-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.cards-product .back {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--ink-3);
  text-decoration: none;
  display: inline-block;
  margin-bottom: 24px;
}
.cards-product .back:hover { color: var(--terra); }
.cards-product .wait-copy {
  color: var(--ink-2);
  font-size: 14.5px;
  line-height: 1.55;
  margin: 0 0 14px;
}
.cards-product .wait-form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.cards-product .wait-input {
  flex: 1 1 180px;
  min-width: 0;
  font-family: var(--serif);
  font-size: 15px;
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 11px 13px;
  outline: none;
}
.cards-product .wait-input:focus {
  border-color: var(--terra);
  box-shadow: 0 0 0 3px var(--terra-tint);
}
.cards-product .wait-error {
  margin: 10px 0 0;
  font-size: 13.5px;
  color: var(--red);
}
.cards-product .wait-success {
  margin: 0;
  font-family: var(--serif);
  font-size: 15px;
  color: var(--olive-d);
  line-height: 1.5;
}
.cards-product .sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`;

export default function CardsProductPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success
  const [error, setError] = useState("");

  const joinWaitlist = async (event) => {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setStatus("loading");
    const { error: invokeErr } = await supabase.functions.invoke("capture-lead", {
      body: { email: trimmed, kind: "physical-deck-waitlist" },
    });
    if (invokeErr) {
      setStatus("idle");
      setError("We couldn't join the waitlist. Please try again.");
      return;
    }
    setStatus("success");
  };

  return (
    <div className="cards-product">
      <style>{css}</style>
      <div className="wrap">
        <Link className="back" to="/">← FamilyPause home</Link>
        <div className="eyebrow">2026 Conversation Cards</div>
        <h1>52 questions for your <em>weekly pause</em></h1>
        <p className="lead">
          One deck per year. Six categories: Connection, Kids, Money, Calendar, Faith, and Fun.
          Unlock the Conversation Starter Card Deck digitally now — or join the waitlist for the printed deck.
        </p>

        <div className="grid">
          <div className="card">
            <div className="coming">Coming soon</div>
            <h2>Conversation Starter Card Deck</h2>
            <ul>
              <li>52 printed conversation cards in a tuck box</li>
              <li>Unlock code inside the box lid (FP-2026-XXXX-0000)</li>
              <li>Digital access included for your whole workspace</li>
            </ul>
            {status === "success" ? (
              <p className="wait-success">
                You&apos;re on the list. We&apos;ll email you when the printed Conversation Starter Card Deck is ready to ship.
              </p>
            ) : (
              <>
                <p className="wait-copy">
                  The printed Conversation Starter Card Deck isn&apos;t available to buy yet. Join the waitlist and we&apos;ll let you know when it ships.
                </p>
                <form className="wait-form" onSubmit={joinWaitlist} noValidate>
                  <label className="sr-only" htmlFor="cards-deck-waitlist-email">Email</label>
                  <input
                    id="cards-deck-waitlist-email"
                    className="wait-input"
                    type="email"
                    name="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    disabled={status === "loading"}
                    required
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={status === "loading" || !email.trim()}
                  >
                    {status === "loading" ? "Joining…" : "Join waitlist"}
                  </button>
                </form>
                {error && <p className="wait-error" role="alert">{error}</p>}
              </>
            )}
          </div>

          <div className="card feat">
            <h2>Digital only</h2>
            <div className="price">{formatDigitalPrice()}</div>
            <ul>
              <li>All 52 prompts in the app</li>
              <li>Permanent access, no expiration</li>
              <li>Both spouses get access instantly</li>
            </ul>
            <div className="btn-row">
              <Link className="btn btn-primary" to={cardsPath("unlock")} style={{ textDecoration: "none" }}>
                Unlock the Conversation Starter Card Deck
              </Link>
              <Link className="btn btn-soft" to="/app" style={{ textDecoration: "none" }}>
                I have a code
              </Link>
            </div>
          </div>
        </div>

        <p className="fineprint" style={{ color: "var(--ink-3)", fontSize: 13 }}>
          Already in the app? Open Settings → Conversation Cards to enter your unlock code.
        </p>
      </div>
    </div>
  );
}
