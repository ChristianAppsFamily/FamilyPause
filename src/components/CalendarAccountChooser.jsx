/**
 * Pre-connect step before Google Calendar OAuth.
 * Explains account choice and shared-calendar setup for couples.
 */
export default function CalendarAccountChooser({
  onConfirm,
  onCancel,
  busy = false,
  compact = false,
}) {
  return (
    <div className={`cal-acct-chooser${compact ? " cal-acct-chooser--compact" : ""}`}>
      <ul className="cal-acct-chooser__bullets">
        <li>Connect a Google account you want to sync your events directly to.</li>
        <li>Your FamilyPause login and your Google account can be different, you&apos;ll choose which Google account to link.</li>
        <li>Planning together? Connect the Google account tied to a calendar you both already have access to.</li>
        <li>
          Don&apos;t have one set up together yet?{" "}
          <a
            className="cal-acct-chooser__link"
            href="https://support.google.com/calendar/answer/37082"
            target="_blank"
            rel="noopener noreferrer"
          >
            Here&apos;s how to share a calendar in Google Calendar
          </a>{" "}
          in under a minute.
        </li>
      </ul>
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
