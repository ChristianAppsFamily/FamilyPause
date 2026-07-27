import { useState } from "react";
import { openStripeCheckout } from "../lib/stripeCheckout";

const css = `
  .sp-backdrop {
    position: fixed; inset: 0; z-index: 90;
    background: rgba(42, 37, 29, 0.45);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; backdrop-filter: blur(2px);
  }
  .sp-modal {
    width: min(100%, 520px);
    background: var(--paper-card);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 28px 24px 22px;
    box-shadow: var(--shadow-lg);
    text-align: center;
    position: relative;
  }
  .sp-x {
    position: absolute; top: 10px; right: 12px;
    width: 34px; height: 34px; border: none; border-radius: 8px;
    background: transparent; color: var(--ink-3); font-size: 22px; cursor: pointer;
  }
  .sp-x:hover { color: var(--terra); background: var(--terra-tint); }
  .sp-eyebrow {
    font-family: var(--mono); font-size: 10px; letter-spacing: .14em;
    text-transform: uppercase; color: var(--terra); margin: 0 0 10px;
  }
  .sp-hl {
    font-family: var(--display); font-style: italic; font-weight: 600;
    font-size: 22px; color: var(--ink); margin: 0 0 8px;
  }
  .sp-sub {
    font-family: var(--serif); font-size: 14px; color: var(--ink-2); margin: 0 0 18px;
  }
  .sp-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px;
  }
  .sp-card {
    position: relative;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 16px 10px 14px;
    background: var(--paper);
    cursor: pointer;
    font-family: var(--serif);
    color: var(--ink);
    transition: border-color .15s, transform .12s, box-shadow .15s;
  }
  .sp-card:hover { border-color: var(--terra); transform: translateY(-1px); }
  .sp-card.feat {
    background: linear-gradient(160deg, var(--terra), #B14F2C);
    border-color: var(--terra);
    color: #fff;
    box-shadow: 0 8px 20px rgba(190,90,55,.28);
  }
  .sp-best {
    position: absolute; top: -9px; left: 50%; transform: translateX(-50%);
    font-family: var(--mono); font-size: 8.5px; letter-spacing: .1em; text-transform: uppercase;
    background: var(--gold); color: #fff; padding: 3px 8px; border-radius: 999px; white-space: nowrap;
  }
  .sp-qty { font-family: var(--display); font-size: 16px; font-weight: 600; margin-bottom: 4px; }
  .sp-price { font-family: var(--mono); font-size: 12px; letter-spacing: .04em; opacity: .85; }
  .sp-card.feat .sp-price { opacity: .95; }
  .sp-alt {
    font-family: var(--mono); font-size: 10px; letter-spacing: .04em; color: var(--ink-3); margin: 0;
  }
  .sp-alt button {
    background: none; border: none; padding: 0; cursor: pointer;
    font: inherit; color: var(--terra); text-decoration: underline; text-underline-offset: 3px;
  }
  @media (max-width: 480px) {
    .sp-grid { grid-template-columns: 1fr; }
  }
`;

const PACKS = [
  { id: "pack_1", label: "1 Session", price: "$1.99", featured: false },
  { id: "pack_3", label: "3 Sessions", price: "$2.99", featured: true },
  { id: "pack_5", label: "5 Sessions", price: "$4.99", featured: false },
];

/**
 * @param {{ onClose: () => void, onOpenPaywall: () => void }} props
 */
export default function SessionPackModal({ onClose, onOpenPaywall }) {
  const [busy, setBusy] = useState(false);

  const buy = async (product) => {
    if (busy) return;
    setBusy(true);
    try {
      await openStripeCheckout(product, {
        successPath: "/subscribe/success?session_id={CHECKOUT_SESSION_ID}&pack=1",
        cancelPath: "/subscribe/cancel",
      });
    } catch (e) {
      console.error("[SessionPack]", e);
      setBusy(false);
    }
  };

  return (
    <div className="sp-backdrop" onMouseDown={onClose} role="presentation">
      <style>{css}</style>
      <div
        className="sp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-pack-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="sp-x" onClick={onClose} aria-label="Close">×</button>
        <div className="sp-eyebrow">Need more sessions</div>
        <h2 className="sp-hl" id="session-pack-title">Get a few more.</h2>
        <p className="sp-sub">One-time purchase, no subscription.</p>
        <div className="sp-grid">
          {PACKS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={"sp-card" + (p.featured ? " feat" : "")}
              disabled={busy}
              onClick={() => buy(p.id)}
            >
              {p.featured && <span className="sp-best">Best value</span>}
              <div className="sp-qty">{p.label}</div>
              <div className="sp-price">{p.price}</div>
            </button>
          ))}
        </div>
        <p className="sp-alt">
          Or get unlimited sessions for $7/month{" "}
          <button type="button" onClick={onOpenPaywall}>Upgrade</button>
        </p>
      </div>
    </div>
  );
}
