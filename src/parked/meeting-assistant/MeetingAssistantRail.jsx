/**
 * PARKED — Meeting Assistant (removed from AgendaBuilder, Jul 2026)
 *
 * UI shell only; no API or agenda read/write was wired before parking.
 * To restore in App.jsx AgendaBuilder:
 *   1. import MeetingAssistantRail, { MeetingAssistantToggle } from '../parked/meeting-assistant/MeetingAssistantRail.jsx'
 *   2. import './meeting-assistant.css' in main.jsx OR move rules back into screens.css
 *   3. const [showAssistant, setShowAssistant] = useState(true)
 *   4. SyncHeader right={<MeetingAssistantToggle show={showAssistant} onToggle={() => setShowAssistant(v => !v)} />}
 *   5. <div className={"worksplit " + (showAssistant ? "with-rail" : "")}> … {showAssistant && <MeetingAssistantRail />}
 */

import "./meeting-assistant.css";

const SPARK = "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z";

const SUGGESTIONS = [
  "Summarize our agenda",
  "What are we forgetting?",
  "Add a note to Finance",
];

function Ico({ d, size = 16, fill = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth={fill ? 0 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export function MeetingAssistantToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      className={"btn " + (show ? "btn-soft" : "btn-ghost")}
      onClick={onToggle}
    >
      <Ico d={SPARK} size={15} /> {show ? "Hide Assistant" : "AI Assistant"}
    </button>
  );
}

export default function MeetingAssistantRail() {
  return (
    <aside className="assist rise">
      <div className="ahead">
        <div className="aico"><Ico d={SPARK} size={17} /></div>
        <div>
          <div className="at">Meeting Assistant</div>
          <div className="as">Reads &amp; writes your agenda</div>
        </div>
      </div>
      <div className="assbubble">
        Hi, I&apos;m here while you talk. I can add notes, draft action items, and tell you what you&apos;re forgetting.
      </div>
      <div className="suggs">
        {SUGGESTIONS.map((label) => (
          <span key={label} className="sugg">{label}</span>
        ))}
      </div>
    </aside>
  );
}
