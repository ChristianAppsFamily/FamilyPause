import { useCallback, useState } from "react";
import "../styles/cards.css";

export const SAMPLE_CARDS = [
  {
    id: 25,
    category: "Marriage",
    question:
      "When did you feel most loved by me this past week? Was it something I did or something I said?",
  },
  {
    id: 2,
    category: "Finances",
    question: "What does financial security actually feel like to you?",
  },
  {
    id: 11,
    category: "Kids",
    question: "What are we most proud of as parents right now?",
  },
  {
    id: 39,
    category: "Dreams",
    question: "What dream have you quietly let go of?",
  },
  {
    id: 47,
    category: "Home",
    question: "What routine is quietly draining us?",
  },
  {
    id: 18,
    category: "Faith",
    question: "Where did you sense God showing up in our family this week?",
  },
  {
    id: 33,
    category: "Marriage",
    question: "What is one thing I could do this week that would make you feel more supported?",
  },
];

/** Alias used by Agenda Conversation Starters (7 free trial cards). */
export const TRIAL_STARTER_CARDS = SAMPLE_CARDS;

const PILL_CLASS = {
  Marriage: "cs-cf-pill--marriage",
  Finances: "cs-cf-pill--finances",
  Kids: "cs-cf-pill--kids",
  Dreams: "cs-cf-pill--dreams",
  Home: "cs-cf-pill--home",
  Faith: "cs-cf-pill--faith",
};

function PauseLogo({ width = 250, height = 362, fill = "#FAF3EC" }) {
  return (
    <svg viewBox="0 0 18 26" width={width} height={height} fill={fill} aria-hidden="true">
      <circle cx="4" cy="3.8" r="3.4" />
      <rect x="0.6" y="8.8" width="6.8" height="16.6" rx="3.4" />
      <circle cx="14" cy="3.8" r="3.4" />
      <rect x="10.6" y="8.8" width="6.8" height="16.6" rx="3.4" />
    </svg>
  );
}

export function CardBackV2({ year = 2026 }) {
  return (
    <div className="cs-cardback-v2 cs-grain">
      <span className="cs-cb-corner tl" aria-hidden="true" />
      <span className="cs-cb-corner tr" aria-hidden="true" />
      <span className="cs-cb-corner bl" aria-hidden="true" />
      <span className="cs-cb-corner br" aria-hidden="true" />
      <div className="cs-cb-ghost">
        <PauseLogo />
      </div>
      <div className="cs-cb-center">
        <div className="cs-cb-wordmark">FamilyPause</div>
        <div className="cs-cb-rule" />
        <div className="cs-cb-meta">Card Deck · {year}</div>
      </div>
    </div>
  );
}

export function CardFrontV2({ card, year = 2026, transitioning = false }) {
  const pillClass = PILL_CLASS[card?.category] || "cs-cf-pill--marriage";

  return (
    <div className={`cs-cardfront-v2 cs-grain${transitioning ? " is-transitioning" : ""}`}>
      <div className="cs-cf-stripe" />
      <div className="cs-cf-inner">
        <div className="cs-cf-rule-d" />
        <div className="cs-cf-head">
          <span className="cs-cf-wordmark">FamilyPause</span>
          <span className="cs-cf-num">{String(card?.id ?? 1).padStart(2, "0")} / 52</span>
        </div>
        <div className={`cs-cf-pill ${pillClass}`}>{card?.category}</div>
        <div className="cs-cf-question">{card?.question}</div>
        <div className="cs-cf-foot">
          <div className="cs-cf-foot-rule" />
          <div className="cs-cf-ii">
            <PauseLogo width={21} height={30} fill="#BE5A37" />
          </div>
          <div className="cs-cf-tag">One Card · One Week · One Conversation</div>
          <div className="cs-cf-year">{year}</div>
          <div className="cs-cf-rule-d" />
        </div>
      </div>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Interactive front-and-back deck preview using the v2 card design.
 * Used on locked cards, unlock deck, and landing page.
 */
export default function SampleCardCarousel({ year = 2026, showCaption = false, className = "" }) {
  const [index, setIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const go = useCallback(
    (dir) => {
      if (transitioning) return;
      if (reducedMotion) {
        setIndex((i) => (i + dir + SAMPLE_CARDS.length) % SAMPLE_CARDS.length);
        return;
      }
      setTransitioning(true);
      window.setTimeout(() => {
        setIndex((i) => (i + dir + SAMPLE_CARDS.length) % SAMPLE_CARDS.length);
        window.setTimeout(() => setTransitioning(false), 175);
      }, 175);
    },
    [transitioning, reducedMotion],
  );

  const card = SAMPLE_CARDS[index];

  return (
    <div className={`sample-card-carousel ${className}`.trim()}>
      <div className="cs-preview-pair cs-preview-pair--interactive">
        <div className="cs-pv-card cs-pv-a">
          <CardBackV2 year={year} />
        </div>
        <div className="cs-pv-face-wrap">
          <button
            type="button"
            className="sample-carousel-arrow"
            onClick={() => go(-1)}
            aria-label="Previous sample card"
          >
            <ChevronLeft />
          </button>
          <div className="cs-pv-card cs-pv-b">
            <CardFrontV2 card={card} year={year} transitioning={transitioning} />
          </div>
          <button
            type="button"
            className="sample-carousel-arrow"
            onClick={() => go(1)}
            aria-label="Next sample card"
          >
            <ChevronRight />
          </button>
        </div>
      </div>

      {showCaption && (
        <div className="cs-pv-cap">Front &amp; back · 52 cards in the deck</div>
      )}

      <div className="sample-carousel-counter" aria-live="polite">
        {index + 1} / {SAMPLE_CARDS.length}
      </div>
    </div>
  );
}
