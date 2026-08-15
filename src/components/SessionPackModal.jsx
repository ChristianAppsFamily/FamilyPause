import { useState } from "react";

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
  .sp-upgrade {
    width: 100%;
    justify-content: center;
  }
`;

/**
 * @param {{ onClose: () => void, onOpenPaywall: () => void }} props
 */
export default function SessionPackModal({ onClose, onOpenPaywall }) {
  const [busy, setBusy] = useState(false);

  const upgrade = () => {
    if (busy) return;
    setBusy(true);
    onOpenPaywall();
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
        <h2 className="sp-hl" id="session-pack-title">Get unlimited sessions.</h2>
        <p className="sp-sub">Upgrade to Family Plan for unlimited builds, $7/month.</p>
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block sp-upgrade"
          disabled={busy}
          onClick={upgrade}
        >
          Upgrade
        </button>
      </div>
    </div>
  );
}
