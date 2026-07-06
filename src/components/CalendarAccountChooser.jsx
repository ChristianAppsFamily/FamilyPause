/**
 * Pre-connect step before Google Calendar OAuth.
 * Explains that FamilyPause login and Google Calendar can use different accounts,
 * then sends the user to Google's account picker.
 */
export default function CalendarAccountChooser({
  familyPauseEmail,
  onConfirm,
  onCancel,
  busy = false,
  compact = false,
}) {
  return (
    <div className={`cal-acct-chooser${compact ? " cal-acct-chooser--compact" : ""}`}>
      <p className="cal-acct-chooser__lead">
        You&apos;re signed into FamilyPause as{" "}
        <strong>{familyPauseEmail || "your account"}</strong>.
      </p>
      <p className="cal-acct-chooser__body">
        Next, Google will ask you to <em>choose which Google account</em> to link.
        It does not have to match your FamilyPause email. Pick the calendar where
        you want family events to appear.
      </p>
      <div className="cal-acct-chooser__actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Opening Google…" : "Choose Google account"}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
