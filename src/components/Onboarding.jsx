// ─────────────────────────────────────────────────────────────────────────────
// Onboarding.jsx - FamilyPause (Elon cut: one Ready screen → Agenda)
// Family names, spouse invite, and card deck are deferred to in-session nudges.
// Reminder day/time is collected here before entering the app.
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { onboardingPath } from "../lib/routes";
import { supabase } from "../lib/supabase";
import ReminderPicker, {
  DEFAULT_REMINDER_DAY,
  DEFAULT_REMINDER_TIME,
} from "./ReminderPicker";
import "../styles/onboarding.css";
import "../styles/reminder.css";

function StepPrimer({ displayName, workspaceId, onComplete }) {
  const first = (displayName || "friend").trim() || "friend";
  const [reminderDay, setReminderDay] = useState(DEFAULT_REMINDER_DAY);
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async () => {
    if (saving) return;
    setSaving(true);
    setError("");

    if (workspaceId) {
      const { error: updErr } = await supabase
        .from("workspaces")
        .update({
          reminder_day: reminderDay,
          reminder_time: reminderTime,
        })
        .eq("id", workspaceId);

      if (updErr) {
        setSaving(false);
        setError(updErr.message || "Couldn't save your reminder. Please try again.");
        return;
      }
    }

    await onComplete?.({ reminderDay, reminderTime });
    setSaving(false);
  };

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

      <div className="ob-anim ob-reminder-wrap" style={{ "--d": "340ms" }}>
        <ReminderPicker
          idPrefix="ob-reminder"
          day={reminderDay}
          time={reminderTime}
          onDayChange={setReminderDay}
          onTimeChange={setReminderTime}
        />
      </div>

      {error && (
        <p className="ob-anim ob-reminder-error" style={{ "--d": "360ms" }} role="alert">{error}</p>
      )}

      <div className="ob-anim" style={{ "--d": "380ms" }}>
        <button type="button" className="ob-btn-primary" onClick={handleStart} disabled={saving}>
          {saving ? "Saving…" : "Start my first FamilyPause →"}
        </button>
      </div>
    </div>
  );
}

export default function Onboarding({ workspaceId, displayName, onComplete }) {
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
        <StepPrimer
          displayName={displayName}
          workspaceId={workspaceId}
          onComplete={onComplete}
        />
      </div>
    </div>
  );
}
