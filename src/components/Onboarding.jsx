// ─────────────────────────────────────────────────────────────────────────────
// Onboarding.jsx - FamilyPause (Elon cut: one primer screen → Agenda)
// Family names, spouse invite, and card deck are deferred to in-session nudges.
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { onboardingPath } from "../lib/routes";
import "../styles/onboarding.css";

function StepPrimer({ displayName, onComplete }) {
  const first = (displayName || "friend").trim() || "friend";

  return (
    <div className="ob-center">
      <div className="ob-anim" style={{ "--d": "0ms" }}>
        <div className="ob-success-circle">
          <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="#FBF6EC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        </div>
      </div>
      <div className="ob-anim" style={{ "--d": "80ms" }}><div className="ob-eyebrow">You&apos;re in · 7-day free trial</div></div>
      <h1 className="ob-anim ob-hl" style={{ "--d": "160ms" }}>
        Welcome to FamilyPause,<br /><em>{first}</em>
      </h1>
      <p className="ob-anim ob-body" style={{ "--d": "230ms" }}>
        Here&apos;s how a session works. Sit down together, and let the app handle the rest. No credit card required.
      </p>
      <div className="ob-anim ob-how-card" style={{ "--d": "300ms" }}>
        {[
          ["🎙️", "Speech to text to transcribe your meeting"],
          ["📋", "Or paste a transcript from Otter"],
          ["✅", "Review cards together, Keep or Discard"],
          ["📅", "Send appointments to Google Calendar"],
        ].map(([emoji, text]) => (
          <div key={text} className="ob-how-row"><span className="ob-how-emoji">{emoji}</span><span>{text}</span></div>
        ))}
      </div>
      <div className="ob-anim" style={{ "--d": "380ms" }}>
        <button type="button" className="ob-btn-primary" onClick={onComplete}>
          Start my first FamilyPause →
        </button>
      </div>
    </div>
  );
}

export default function Onboarding({ displayName, onComplete }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const m = location.pathname.match(/\/app\/onboarding\/(\d+)/);
    const n = m ? parseInt(m[1], 10) : 1;
    if (n !== 1) navigate(onboardingPath(1), { replace: true });
  }, [location.pathname, navigate]);

  return (
    <div className="ob-page">
      <div className="ob-column">
        <StepPrimer displayName={displayName} onComplete={onComplete} />
      </div>
    </div>
  );
}
