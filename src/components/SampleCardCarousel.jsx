import { useState, useCallback } from "react";

const T = {
  bg: "#FBF6EC",
  border: "#E6D9C4",
  text: "#2A251D",
  mid: "#5B5245",
  muted: "#8C8070",
  terra: "#BE5A37",
  terraD: "#A2481F",
  terraL: "#FAEAE0",
  oliveL: "#EDF0E1",
  oliveD: "#4C5829",
  olive: "#5E6B37",
  goldL: "#F0E3C0",
  goldD: "#8A6A16",
  gold: "#C09740",
};

const SAMPLES = [
  {
    category: "Finances",
    question: "What does financial security actually feel like to you?",
    colors: { bg: T.goldL, text: T.goldD, border: T.gold },
  },
  {
    category: "Marriage",
    question: "When did you feel most loved by me this past week?",
    colors: { bg: T.terraL, text: T.terraD, border: T.terra },
  },
  {
    category: "Kids",
    question: "What are we most proud of as parents right now?",
    colors: { bg: T.oliveL, text: T.oliveD, border: T.olive },
  },
  {
    category: "Dreams",
    question: "What dream have you quietly let go of?",
    colors: { bg: "#E8E0F0", text: "#3A1A60", border: "#8A5AC0" },
  },
];

function SampleCard({ card, animating }) {
  const cat = card.colors;
  const reduced = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  return (
    <div
      style={{
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 20,
        padding: "32px 28px",
        boxShadow: "0 16px 48px rgba(46,40,32,0.12)",
        position: "relative",
        overflow: "hidden",
        transition: reduced ? "none" : "opacity 400ms ease, transform 400ms ease",
        opacity: animating ? 0 : 1,
        transform: animating ? "translateX(12px)" : "translateX(0)",
      }}
    >
      <div style={{
        position: "absolute", top: 0, right: 0, width: 72, height: 72,
        background: `linear-gradient(225deg, ${cat.bg} 0%, transparent 60%)`,
        pointerEvents: "none",
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.muted, letterSpacing: "0.2em" }}>
          FAMILYPAUSE · 2026
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.muted, letterSpacing: "0.1em" }}>
          SAMPLE
        </span>
      </div>
      <div style={{
        display: "inline-block", background: cat.bg, color: cat.text,
        border: `1px solid ${cat.border}44`, padding: "4px 12px", borderRadius: 20,
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.08em",
        marginBottom: 20, textTransform: "uppercase",
      }}>
        {card.category}
      </div>
      <p style={{
        fontFamily: "'Playfair Display', serif", fontSize: 22, lineHeight: 1.45,
        color: T.text, fontWeight: 500, margin: 0,
      }}>
        {card.question}
      </p>
    </div>
  );
}

export default function SampleCardCarousel({ title = "Preview the cards" }) {
  const [index, setIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  const go = useCallback((dir) => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setIndex((i) => (i + dir + SAMPLES.length) % SAMPLES.length);
      setAnimating(false);
    }, 200);
  }, [animating]);

  const card = SAMPLES[index];

  return (
    <div className="sample-carousel" style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
      {title && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.22em",
          textTransform: "uppercase", color: T.terra, marginBottom: 16, textAlign: "center",
        }}>
          {title}
        </div>
      )}
      <div style={{ position: "relative" }}>
        <SampleCard card={card} animating={animating} />
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 16, gap: 12,
        }}>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous card"
            style={{
              width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`,
              background: "#FCF8F0", cursor: "pointer", fontSize: 18, color: T.mid,
            }}
          >
            ‹
          </button>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.muted }}>
            {index + 1} / {SAMPLES.length}
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next card"
            style={{
              width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`,
              background: "#FCF8F0", cursor: "pointer", fontSize: 18, color: T.mid,
            }}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
