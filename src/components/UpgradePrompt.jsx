import { useEffect } from "react";

const css = `
  .upgrade-prompt-scrim {
    position: fixed;
    inset: 0;
    z-index: 110;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(42, 37, 29, .42);
  }
  .upgrade-prompt-card {
    width: 100%;
    max-width: 410px;
    padding: 26px;
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    background: var(--paper-card);
    box-shadow: var(--shadow-lg);
  }
  .upgrade-prompt-card h2 {
    margin: 0 0 9px;
    color: var(--ink);
    font-family: var(--display);
    font-size: 18px;
    font-style: italic;
    font-weight: 600;
    line-height: 1.3;
  }
  .upgrade-prompt-card p {
    margin: 0 0 20px;
    color: var(--ink-2);
    font-family: var(--serif);
    font-size: 13px;
    line-height: 1.55;
  }
  .upgrade-prompt-actions {
    display: flex;
    gap: 10px;
  }
  .upgrade-prompt-actions .btn { flex: 1; justify-content: center; }
  @media (max-width: 480px) {
    .upgrade-prompt-actions { flex-direction: column; }
  }
`;

export default function UpgradePrompt({ title, body, onUpgrade, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="upgrade-prompt-scrim" onMouseDown={onClose}>
      <style>{css}</style>
      <div
        className="upgrade-prompt-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-prompt-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="upgrade-prompt-title">{title}</h2>
        <p>{body}</p>
        <div className="upgrade-prompt-actions">
          <button type="button" className="btn btn-primary" onClick={onUpgrade}>Upgrade</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Not now</button>
        </div>
      </div>
    </div>
  );
}
