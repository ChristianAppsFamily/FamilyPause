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
      <p className="cal-acct-chooser__body">
        Connect a Google account to add dated items from your weekly plan directly to your calendar.
        Your FamilyPause login and your Google account can be different, you&apos;ll choose which Google account to link.
      </p>
      <p className="cal-acct-chooser__body">
        Planning together? Connect the Google account tied to a calendar you both already have access to.
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
