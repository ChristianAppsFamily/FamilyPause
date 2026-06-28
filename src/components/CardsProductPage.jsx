import { Link } from "react-router-dom";
import { cardsPath } from "../lib/routes";

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
`;

export default function CardsProductPage() {
  return (
    <div className="cards-product">
      <style>{css}</style>
      <div className="wrap">
        <Link className="back" to="/">← FamilyPause home</Link>
        <div className="eyebrow">2026 Conversation Deck</div>
        <h1>52 questions for your <em>weekly pause</em></h1>
        <p className="lead">
          One deck per year. Six categories — Connection, Kids, Money, Calendar, Faith, and Fun.
          Unlock the in-app card draw with a code from the physical box or buy digital-only access.
        </p>

        <div className="grid">
          <div className="card feat">
            <h2>Physical deck</h2>
            <div className="price">$24</div>
            <ul>
              <li>52 printed conversation cards in a tuck box</li>
              <li>Unlock code inside the box lid (FP-2026-XXXX-0000)</li>
              <li>Digital access included for your whole workspace</li>
            </ul>
            <p style={{ color: "var(--ink-2)", fontSize: 14.5, margin: 0 }}>
              Available at launch — order through FamilyPause when inventory is live.
            </p>
          </div>

          <div className="card">
            <h2>Digital only</h2>
            <div className="price">$12</div>
            <ul>
              <li>All 52 prompts in the app</li>
              <li>Permanent access — no expiration</li>
              <li>Both spouses get access instantly</li>
            </ul>
            <div className="btn-row">
              <Link className="btn btn-primary" to={cardsPath("unlock")} style={{ textDecoration: "none" }}>
                Purchase digital access
              </Link>
              <Link className="btn btn-soft" to="/app" style={{ textDecoration: "none" }}>
                I have a code
              </Link>
            </div>
          </div>
        </div>

        <p className="fineprint" style={{ color: "var(--ink-3)", fontSize: 13 }}>
          Already in the app? Open Settings → Card decks to enter your unlock code.
        </p>
      </div>
    </div>
  );
}
