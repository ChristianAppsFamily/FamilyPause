// ─────────────────────────────────────────────────────────────────────────────
// CardSystem.jsx - FamilyPause
//
// Contains four components:
//   1. CardDraw        : Pre-session card reveal (locked / unlocked)
//   2. UnlockDeck      : Code entry + Stripe digital purchase
//   3. DeckLibrary     : All owned decks + new year awareness card
//   4. CardSystemRoot  : Router between the above
//
// Drop into: src/components/CardSystem.jsx
// Requires:  src/lib/supabase.js
//
// Props for CardSystemRoot:
//   workspace       : Supabase workspace object
//   onStartSession  : callback when user taps "Start Recording" after card draw
//   onClose         : callback to dismiss/navigate away
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { playCardFlip, soundsEnabledForWorkspace } from "../lib/sounds";
import { openPaymentLink, STRIPE_LINKS } from "../lib/stripeLinks";
import { DIGITAL_DECK_PRICE, formatDigitalPrice, PHYSICAL_DECK_PRICE } from "../lib/deckPricing";
import SampleCardCarousel from "./SampleCardCarousel";
import "../styles/cards.css";

function formatSyncDate(dateStr) {
  const dt = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function SyncDatePill({ meetingDate }) {
  return (
    <div
      className="cs-sync-date"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        letterSpacing: "0.08em",
        color: T.gold,
        background: T.goldL,
        border: `1px solid ${T.gold}44`,
        borderRadius: 999,
        padding: "8px 14px",
        marginBottom: 20,
      }}
    >
      {formatSyncDate(meetingDate)}
    </div>
  );
}

// ── PALETTE ───────────────────────────────────────────────────────────────────
// Palette mapped to the design bundle (src/styles/tokens.css): source of truth.
const T = {
  bg:       "#FBF6EC",  // --paper
  surface:  "#FCF8F0",  // --paper-card
  surface2: "#F4EAD8",  // --paper-2
  border:   "#E6D9C4",  // --line
  text:     "#2A251D",  // --ink
  mid:      "#5B5245",  // --ink-2
  muted:    "#8C8070",  // --ink-3
  terra:    "#BE5A37",  // --terra
  terraL:   "#FAEAE0",  // --terra-tint
  terraD:   "#A2481F",  // --terra-d
  olive:    "#5E6B37",  // --olive
  oliveL:   "#EDF0E1",  // --olive-tint
  oliveDark:"#4C5829",  // --olive-d
  gold:     "#C09740",  // --gold
  goldL:    "#F0E3C0",  // --gold-soft
  goldD:    "#8A6A16",  // gold dark text
  brown:    "#8C8070",  // --ink-3
  red:      "#C0402F",  // --red
  redL:     "#FBEAE5",  // --red-tint
};

// ── CARD DATA ─────────────────────────────────────────────────────────────────
const DECKS = {
  2026: {
    year: 2026,
    theme: "Foundations",
    tagline: "52 questions that go deeper than the to-do list.",
    available: true,
    physicalPrice: PHYSICAL_DECK_PRICE,
    digitalPrice: DIGITAL_DECK_PRICE,
    cards: [
      // FINANCES
      { id: 1,  category: "Finances",  question: "If our income doubled tomorrow, what's the first thing we'd change, and what would we keep exactly the same?" },
      { id: 2,  category: "Finances",  question: "What does financial security actually feel like to you? How close are we to that feeling right now?" },
      { id: 3,  category: "Finances",  question: "Is there a purchase one of us has been wanting that we haven't talked about? What's stopped us from bringing it up?" },
      { id: 4,  category: "Finances",  question: "Where do you think we waste the most money without realizing it? What would you cut first?" },
      { id: 5,  category: "Finances",  question: "What did money mean in the home you grew up in? How has that shaped the way you handle it now?" },
      { id: 6,  category: "Finances",  question: "If we had to live on half our current income for a year, what would that actually look like?" },
      { id: 7,  category: "Finances",  question: "Are we giving at the level we want to be? If not, what's in the way?" },
      { id: 8,  category: "Finances",  question: "What's one financial goal you want us to hit before the end of this year that we haven't talked enough about?" },
      { id: 9,  category: "Finances",  question: "Do you feel like financial decisions in our home are made equally between us? What would more balance look like?" },
      { id: 10, category: "Finances",  question: "What does generosity mean to you practically, not in theory, but in how we actually spend?" },
      // KIDS
      { id: 11, category: "Kids",      question: "What's one thing about how we're raising our kids that you're really proud of right now?" },
      { id: 12, category: "Kids",      question: "Is there something you wish we handled differently as parents that you haven't said out loud yet?" },
      { id: 13, category: "Kids",      question: "Which of our kids do you feel like you understand the least right now? What would help?" },
      { id: 14, category: "Kids",      question: "What values do you most want our kids to carry into adulthood? Are we actively building those or just hoping?" },
      { id: 15, category: "Kids",      question: "How do you think our kids would describe our home if someone asked them? Is that the answer you want?" },
      { id: 16, category: "Kids",      question: "Are we spending individual time with each kid, or always together as a group? Does that need to change?" },
      { id: 17, category: "Kids",      question: "What's a memory from your own childhood you want to recreate for our kids? What's stopping us?" },
      { id: 18, category: "Kids",      question: "How do you feel about the amount of screen time in our home right now, for the kids and for us?" },
      { id: 19, category: "Kids",      question: "Are there any friendships in our kids' lives that concern you? Any you're really grateful for?" },
      { id: 20, category: "Kids",      question: "What's one conversation we need to have with one of our kids that we've been putting off?" },
      // MARRIAGE
      { id: 21, category: "Marriage",  question: "When did you feel most loved by me this past week? Was it something I did or something I said?" },
      { id: 22, category: "Marriage",  question: "Is there anything you've needed from me lately that you haven't asked for? What made it hard to ask?" },
      { id: 23, category: "Marriage",  question: "What's something I do that makes you feel like we're a real team? What's something that makes you feel alone?" },
      { id: 24, category: "Marriage",  question: "When's the last time we laughed really hard together? What were we doing?" },
      { id: 25, category: "Marriage",  question: "What does a great marriage look like to you five years from now? Are we building toward that?" },
      { id: 26, category: "Marriage",  question: "Is there anything from the past month that left a mark on you that we never fully talked through?" },
      { id: 27, category: "Marriage",  question: "What's one thing you miss about early in our relationship that we've let go of?" },
      { id: 28, category: "Marriage",  question: "How do you feel about the amount of physical affection in our relationship right now?" },
      { id: 29, category: "Marriage",  question: "What's one specific thing I could do this week that would make you feel deeply valued?" },
      { id: 30, category: "Marriage",  question: "If you had to describe our marriage to a friend in three words, what would they be? What words do you wish they'd be?" },
      // FAITH
      { id: 31, category: "Faith",     question: "How is your faith actually doing right now, not the Sunday version, the real version?" },
      { id: 32, category: "Faith",     question: "Is there something God has been putting on your heart that you haven't shared with me yet?" },
      { id: 33, category: "Faith",     question: "Do you feel like we're building a spiritual life as a family or just attending things? What's the difference?" },
      { id: 34, category: "Faith",     question: "What does prayer look like for us right now? Is it what you want it to be?" },
      { id: 35, category: "Faith",     question: "Is there a way you feel called to serve that we haven't made room for yet?" },
      { id: 36, category: "Faith",     question: "What does a faith-centered home actually look like day to day to you? How close are we?" },
      { id: 37, category: "Faith",     question: "What's a scripture or idea that has been sitting with you lately? Why that one?" },
      { id: 38, category: "Faith",     question: "Are we the kind of married couple we'd want our kids to marry someone like? What would we change?" },
      // DREAMS
      { id: 39, category: "Dreams",    question: "What's a dream you had before we got together that you've quietly let go of? Does it still matter?" },
      { id: 40, category: "Dreams",    question: "If you could design the next five years of our life from scratch, what would they look like?" },
      { id: 41, category: "Dreams",    question: "Is there something you've always wanted to try, a business, a creative project, a place to live, that we've never seriously discussed?" },
      { id: 42, category: "Dreams",    question: "What does retirement actually look like to you? Are we building toward that picture?" },
      { id: 43, category: "Dreams",    question: "If money and logistics were completely off the table, where would we live and how would we spend our days?" },
      { id: 44, category: "Dreams",    question: "What legacy do you want us to leave, not as individuals, but as a family?" },
      { id: 45, category: "Dreams",    question: "Is there a version of our life that feels like we're playing it too safe? What would bold look like?" },
      { id: 46, category: "Dreams",    question: "What's one thing you want to accomplish in the next 12 months that is just for you?" },
      // HOME
      { id: 47, category: "Home",      question: "Is there something about our home or our daily routine that drains you that we haven't fixed?" },
      { id: 48, category: "Home",      question: "How do you feel about the division of responsibilities in our household right now? What's off?" },
      { id: 49, category: "Home",      question: "What does rest actually look like for you? Are you getting enough of it?" },
      { id: 50, category: "Home",      question: "Is there a rhythm or tradition we've let slip that you want to bring back?" },
      { id: 51, category: "Home",      question: "What's the most stressful part of a typical week for you? Does it have to be that way?" },
      { id: 52, category: "Home",      question: "If we could change one thing about how our household runs starting this week, what would you change?" },
    ],
  },
  2027: {
    year: 2027,
    theme: "Legacy & Vision",
    tagline: "52 questions about where you're going and who you're becoming.",
    available: true,
    physicalPrice: PHYSICAL_DECK_PRICE,
    digitalPrice: DIGITAL_DECK_PRICE,
    cards: [], // populate when ready
  },
};

const CAT_COLORS = {
  Finances: { bg: T.goldL,   text: T.goldD,    border: T.gold  },
  Kids:     { bg: T.oliveL,  text: T.oliveDark,border: T.olive },
  Marriage: { bg: T.terraL,  text: T.terraD,   border: T.terra },
  Faith:    { bg: "#EDE8D4", text: "#5A4A10",  border: "#B8980C" },
  Dreams:   { bg: "#E8E0F0", text: "#3A1A60",  border: "#8A5AC0" },
  Home:     { bg: T.surface, text: T.mid,      border: T.brown },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes spin {
    from { transform: rotate(0deg); } to { transform: rotate(360deg); }
  }
  @keyframes cardFlip {
    0%   { transform: rotateY(90deg) scale(0.95); opacity: 0; }
    100% { transform: rotateY(0deg)  scale(1);    opacity: 1; }
  }
  @keyframes cardFloat {
    0%,100% { transform: translateY(0px) rotate(-1deg); }
    50%     { transform: translateY(-8px) rotate(-1deg); }
  }
  @keyframes lockShake {
    0%,100% { transform: translateX(0); }
    20%,60% { transform: translateX(-4px); }
    40%,80% { transform: translateX(4px); }
  }
  @keyframes pulse {
    0%,100% { opacity: 1; } 50% { opacity: 0.5; }
  }
  @keyframes sparkle {
    0%   { transform: scale(0) rotate(0deg);   opacity: 0; }
    50%  { transform: scale(1.3) rotate(180deg); opacity: 1; }
    100% { transform: scale(1) rotate(360deg); opacity: 0.8; }
  }

  .cs-fade   { animation: fadeUp 0.5s ease both; }
  .cs-fade-1 { animation: fadeUp 0.5s 0.08s ease both; }
  .cs-fade-2 { animation: fadeUp 0.5s 0.16s ease both; }
  .cs-fade-3 { animation: fadeUp 0.5s 0.24s ease both; }
  .cs-fade-4 { animation: fadeUp 0.5s 0.32s ease both; }

  .card-flip  { animation: cardFlip 0.6s cubic-bezier(0.34,1.56,0.64,1) both; }
  .card-float { animation: cardFloat 5s ease-in-out infinite; }

  .cs-input {
    width: 100%;
    background: ${T.bg};
    border: 1px solid ${T.border};
    border-radius: 8px;
    color: ${T.text};
    padding: 13px 16px;
    font-size: 16px;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transition: border-color 0.2s, box-shadow 0.2s;
    outline: none;
    text-align: center;
  }
  .cs-input:focus {
    border-color: ${T.terra};
    box-shadow: 0 0 0 3px ${T.terraL};
  }
  .cs-input::placeholder {
    color: ${T.muted};
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .cs-btn-primary {
    width: 100%;
    background: ${T.terra};
    color: ${T.bg};
    border: none; border-radius: 10px;
    padding: 15px; font-size: 16px;
    font-family: 'Lora', serif;
    cursor: pointer; transition: all 0.2s;
    box-shadow: 0 4px 16px rgba(190,90,55,0.25);
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .cs-btn-primary:hover:not(:disabled) {
    background: ${T.terraD};
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(190,90,55,0.35);
  }
  .cs-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

  .cs-btn-ghost {
    background: none;
    border: 1px solid ${T.border};
    border-radius: 10px; color: ${T.mid};
    padding: 13px; font-size: 14px;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.05em; cursor: pointer;
    width: 100%; transition: all 0.2s;
  }
  .cs-btn-ghost:hover { border-color: ${T.terra}; color: ${T.terra}; }

  .cs-btn-olive {
    width: 100%;
    background: ${T.olive};
    color: ${T.bg};
    border: none; border-radius: 10px;
    padding: 15px; font-size: 16px;
    font-family: 'Lora', serif;
    cursor: pointer; transition: all 0.2s;
    box-shadow: 0 4px 16px rgba(74,103,65,0.25);
  }
  .cs-btn-olive:hover {
    background: ${T.oliveDark};
    transform: translateY(-1px);
  }

  .deck-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(46,40,32,0.1);
  }
`;

// ── SMALL SPINNER ─────────────────────────────────────────────────────────────
function Spinner({ color = T.bg }) {
  return (
    <div style={{
      width: 18, height: 18,
      border: `2px solid rgba(255,255,255,0.3)`,
      borderTopColor: color,
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
      flexShrink: 0,
    }} />
  );
}

// ── CARD VISUAL ───────────────────────────────────────────────────────────────
function CardFace({ card, deckYear, flipped = true, style = {} }) {
  const cat = CAT_COLORS[card?.category] || CAT_COLORS.Home;
  return (
    <div style={{
      background: T.bg,
      border: `1px solid ${T.border}`,
      borderRadius: 20,
      padding: "36px 32px",
      boxShadow: "0 20px 60px rgba(46,40,32,0.14), 0 4px 16px rgba(46,40,32,0.08)",
      position: "relative",
      overflow: "hidden",
      animation: flipped ? "cardFlip 0.6s cubic-bezier(0.34,1.56,0.64,1) both" : "none",
      ...style,
    }}>
      {/* Decorative corner */}
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: 80, height: 80,
        background: `linear-gradient(225deg, ${cat.bg} 0%, transparent 60%)`,
        pointerEvents: "none",
      }} />

      {/* Year + deck badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.muted, letterSpacing: "0.2em" }}>
          FAMILYPAUSE · {deckYear}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.muted, letterSpacing: "0.1em" }}>
          #{String(card?.id).padStart(2, "0")} / 52
        </div>
      </div>

      {/* Category pill */}
      <div style={{
        display: "inline-block",
        background: cat.bg, color: cat.text,
        border: `1px solid ${cat.border}44`,
        padding: "4px 12px", borderRadius: 20,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11, letterSpacing: "0.08em",
        marginBottom: 24,
      }}>
        {card?.category}
      </div>

      {/* Question */}
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 22, fontWeight: 400,
        color: T.text, lineHeight: 1.45,
        marginBottom: 32,
      }}>
        {card?.question}
      </div>

      {/* Bottom ornament */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        borderTop: `1px solid ${T.border}`,
        paddingTop: 20,
      }}>
        <div style={{ flex: 1, height: 1, background: T.border }} />
        <div style={{ color: T.terra, fontSize: 14 }}>⁋</div>
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>
    </div>
  );
}

function CardBack({ style = {}, year = 2026 }) {
  return (
    <div className="cs-cardback grain" style={style}>
      <span className="cs-corner tl" aria-hidden="true" />
      <span className="cs-corner tr" aria-hidden="true" />
      <span className="cs-corner bl" aria-hidden="true" />
      <span className="cs-corner br" aria-hidden="true" />
      <div className="cs-cardback-mark" aria-hidden="true">&ldquo;</div>
      <div className="cs-cardback-quote" aria-hidden="true">⁋</div>
      <div className="cs-cardback-title">FamilyPause</div>
      <div className="cs-cardback-meta">Card Deck · {year}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CARD DRAW: pre-session screen
// ─────────────────────────────────────────────────────────────────────────────
function CardDraw({ workspace, meetingDate, onStartSession, onSkip, onUnlock }) {
  const [phase, setPhase] = useState("intro"); // intro | drawing | revealed | locked
  const [drawnCard, setDrawnCard] = useState(null);
  const [deckYear, setDeckYear] = useState(2026);

  // DEV/TESTING bypass removed — decks require purchase or code redemption.
  const unlockedDecks = workspace?.cards_unlocked
    ? (workspace?.unlocked_deck_years?.length > 0 ? workspace.unlocked_deck_years : [])
    : [];

  const hasUnlockedDeck = unlockedDecks.length > 0;
  const activeDeck = hasUnlockedDeck
    ? DECKS[unlockedDecks[unlockedDecks.length - 1]]
    : null;

  const drawCard = () => {
    if (!activeDeck || !activeDeck.cards.length) return;
    const random = activeDeck.cards[Math.floor(Math.random() * activeDeck.cards.length)];
    setDrawnCard(random);
    setDeckYear(activeDeck.year);
    setPhase("drawing");
    setTimeout(() => setPhase("revealed"), 800);
  };

  const soundsOn = soundsEnabledForWorkspace(workspace);
  const flipPlayedRef = useRef(false);
  useEffect(() => {
    if (phase !== "revealed" || flipPlayedRef.current) return;
    flipPlayedRef.current = true;
    playCardFlip(soundsOn);
  }, [phase, soundsOn]);
  useEffect(() => {
    if (phase !== "revealed") flipPlayedRef.current = false;
  }, [phase]);

  // LOCKED STATE
  if (!hasUnlockedDeck || phase === "intro") {
    if (!hasUnlockedDeck) {
      const previewYear = 2026;

      return (
        <div style={{ background: T.bg, fontFamily: "'Lora', serif" }}>
          <style>{css}</style>

          <div className="cs-locked-screen">
            <div className="cs-fade" style={{ width: "100%", maxWidth: 520 }}>
              <SampleCardCarousel year={previewYear} showCaption />
            </div>

            <div className="cs-fade-2" style={{ marginBottom: 30, width: "100%", maxWidth: 420 }}>
              <SyncDatePill meetingDate={meetingDate} />
              <div className="cs-eyebrow" style={{ marginBottom: 12 }}>The {previewYear} Deck</div>
              <h1 className="cs-hl">
                A question to sit with <em>before you record</em>
              </h1>
              <p className="cs-sub">
                Each card opens one honest conversation. 52 of them, one per week, that go deeper than the to-do list.
              </p>
            </div>

            <div className="cs-btn-stack cs-fade-3">
              <button type="button" className="cs-btn-primary" onClick={onUnlock}>
                I have the deck, enter my code
              </button>
              <a
                href="https://familypause.com/cards"
                target="_blank"
                rel="noreferrer"
                className="cs-btn-gold"
              >
                {`Get the card deck, $${PHYSICAL_DECK_PRICE} →`}
              </a>
              <button type="button" className="cs-btn-ghost-lora" onClick={onSkip}>
                Skip, start session without a card
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // INTRO: has deck, show draw prompt
  if (phase === "intro") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", fontFamily: "'Lora', serif" }}>
        <style>{css}</style>
        <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
          <SyncDatePill meetingDate={meetingDate} />
          <div style={{ marginBottom: 40 }}>
            <CardBack />
          </div>

          <div className="cs-fade" style={{ fontSize: 11, letterSpacing: "0.25em", color: T.terra, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", marginBottom: 12 }}>
            Before you begin
          </div>
          <h2 className="cs-fade-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 400, color: T.text, marginBottom: 12 }}>
            Pull your card<br /><em style={{ color: T.terra }}>for this week.</em>
          </h2>
          <p className="cs-fade-2" style={{ fontSize: 15, color: T.mid, lineHeight: 1.65, marginBottom: 36 }}>
            Read it together. Sit with it. Then hit record and let it shape your conversation.
          </p>

          <div className="cs-fade-3" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="cs-btn-primary" onClick={drawCard} style={{ fontSize: 18, padding: 18 }}>
              Draw This Week's Card
            </button>
            <button className="cs-btn-ghost" onClick={onSkip}>
              Skip and start session without a card
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DRAWING: brief loading moment
  if (phase === "drawing") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{css}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ animation: "cardFloat 1s ease-in-out infinite", marginBottom: 32 }}>
            <CardBack style={{ width: 280, margin: "0 auto" }} />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.muted, letterSpacing: "0.15em", animation: "pulse 1s ease-in-out infinite" }}>
            DRAWING YOUR CARD...
          </div>
        </div>
      </div>
    );
  }

  // REVEALED
  if (phase === "revealed" && drawnCard) {
    const cat = CAT_COLORS[drawnCard.category] || CAT_COLORS.Home;
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", fontFamily: "'Lora', serif" }}>
        <style>{css}</style>
        <div style={{ width: "100%", maxWidth: 460 }}>

          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <SyncDatePill meetingDate={meetingDate} />
            <div className="cs-fade" style={{ fontSize: 11, letterSpacing: "0.25em", color: T.terra, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", marginBottom: 8 }}>
              This week's card
            </div>
            <div className="cs-fade-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: T.muted, fontStyle: "italic" }}>
              {DECKS[deckYear]?.theme} · {deckYear}
            </div>
          </div>

          <CardFace card={drawnCard} deckYear={deckYear} />

          <div className="cs-fade-2" style={{ marginTop: 12, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: T.muted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
              Read it together. Sit with it for a moment.
            </div>
          </div>

          <div className="cs-fade-3" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 28 }}>
            <button className="cs-btn-olive" onClick={() => onStartSession(drawnCard)}>
              🎙 Start Recording
            </button>
            <button onClick={drawCard} style={{
              background: "none", border: "none",
              color: T.terra, fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, letterSpacing: "0.08em", cursor: "pointer",
              padding: "10px", textDecoration: "underline",
              textUnderlineOffset: 3,
            }}>
              Draw a different card
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. UNLOCK DECK: code entry + digital purchase
// ─────────────────────────────────────────────────────────────────────────────
function UnlockDeck({ workspace, onSuccess, onClose }) {
  const [tab, setTab] = useState("code"); // code | digital
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 200); }, []);

  const handleRedeem = async () => {
    if (!code.trim()) { setError("Please enter your deck code."); return; }
    setLoading(true);
    setError("");

    const { data, error: dbErr } = await supabase
      .from("deck_codes")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .single();

    if (dbErr || !data) {
      setError("Code not found. Check the inside of your deck box and try again.");
      setLoading(false);
      return;
    }

    if (data.redeemed_by) {
      setError("This code has already been redeemed. If you think this is an error, contact support.");
      setLoading(false);
      return;
    }

    // Mark code as redeemed
    const { data: { user: redeemer } } = await supabase.auth.getUser();
    const { error: redeemErr } = await supabase.from("deck_codes").update({
      redeemed_by: redeemer?.id,
      redeemed_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (redeemErr) { setError("Failed to redeem code. Please try again."); setLoading(false); return; }

    // Unlock on workspace
    const currentYears = workspace?.unlocked_deck_years || [];
    const deckYear = data.deck_year || 2026;
    const updatedYears = [...new Set([...currentYears, deckYear])];

    const { error: unlockErr } = await supabase.from("workspaces").update({
      cards_unlocked: true,
      unlocked_deck_years: updatedYears,
    }).eq("id", workspace.id);
    if (unlockErr) { setError("Code accepted but workspace update failed. Contact support."); setLoading(false); return; }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => onSuccess(deckYear), 2000);
  };

  const handleDigitalPurchase = () => {
    openPaymentLink(STRIPE_LINKS.cardDigital || STRIPE_LINKS.digital);
  };

  if (success) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{css}</style>
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: T.oliveL, border: `2px solid ${T.olive}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, margin: "0 auto 24px",
            animation: "sparkle 0.6s ease both",
          }}>✓</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: T.text, marginBottom: 12 }}>
            Deck unlocked.
          </h2>
          <p style={{ fontSize: 15, color: T.mid, lineHeight: 1.6 }}>
            Your 2026 FamilyPause cards are ready. Pull your first card before your next session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cs-unlock-screen">
      <style>{css}</style>
      <div className="cs-unlock-inner">

        <button type="button" className="cs-unlock-back cs-fade" onClick={onClose}>← Back</button>

        <div className="cs-fade" style={{ marginBottom: 28 }}>
          <SampleCardCarousel showCaption />
        </div>

        <div className="cs-unlock-eyebrow cs-fade">Unlock cards</div>
        <h1 className="cs-unlock-hl cs-fade-1">Add your <em>card deck</em></h1>
        <p className="cs-unlock-sub cs-fade-2">
          Unlock the weekly card draw feature with a physical deck code, or purchase digital access directly.
        </p>

        <div className="cs-tab-sw cs-fade-2">
          {[
            { id: "code", label: "I have the deck" },
            { id: "digital", label: `Buy digital (${formatDigitalPrice()})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "active" : ""}
              onClick={() => { setTab(t.id); setError(""); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "code" && (
          <div className="cs-fade">
            <div style={{ marginBottom: 8 }}>
              <label className="cs-unlock-label" htmlFor="deck-code">Deck code</label>
              <input
                id="deck-code"
                ref={inputRef}
                className="cs-code-input"
                type="text"
                placeholder="FP-2026-XXXX-0000"
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
              />
              <div className="cs-unlock-hint">
                Found inside the lid of your FamilyPause Card Deck box.
              </div>
            </div>

            {error && (
              <div style={{ background: T.redL, border: `1px solid ${T.red}33`, borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: T.red, fontFamily: "'JetBrains Mono', monospace" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button type="button" className="cs-btn-primary" style={{ padding: "16px", fontSize: 17 }} onClick={handleRedeem} disabled={loading || !code.trim()}>
                {loading ? <><Spinner /> Verifying...</> : "Unlock My Cards"}
              </button>
            </div>

            <div className="cs-info-gold">
              <div className="cs-info-gold-title">Don&apos;t have the deck yet?</div>
              <p>
                Get the physical deck at <a href="https://familypause.com/cards" target="_blank" rel="noreferrer" style={{ color: T.terra }}>familypause.com/cards</a> for {`$${PHYSICAL_DECK_PRICE}`}. Includes 52 cards, a beautiful tuck box, and your digital unlock code.
              </p>
            </div>
          </div>
        )}

        {tab === "digital" && (
          <div className="cs-fade">
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "26px", marginBottom: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: T.text, marginBottom: 6 }}>2026 Digital Card Set</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: T.muted, letterSpacing: "0.05em" }}>52 cards · Permanent access · No expiration</div>
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: T.terra }}>{formatDigitalPrice()}</div>
              </div>
              {["52 weekly conversation prompts", "Organized across 6 categories", "Card draw feature unlocked permanently", "Both spouses get access instantly"].map((f) => (
                <div key={f} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <span style={{ color: T.olive, fontSize: 14 }}>→</span>
                  <span style={{ fontSize: 15, color: T.mid }}>{f}</span>
                </div>
              ))}
            </div>

            <button type="button" className="cs-btn-primary" style={{ padding: "16px", fontSize: 17 }} onClick={handleDigitalPurchase}>
              Purchase Digital Access, {formatDigitalPrice()}
            </button>
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>
              Secure payment via Stripe · Instant access
            </div>

            <div style={{ marginTop: 18, padding: "14px 18px", background: T.terraL, border: `1px solid ${T.terra}22`, borderRadius: 10 }}>
              <div style={{ fontSize: 15, color: T.terraD, lineHeight: 1.55 }}>
                Want the physical experience too? The printed deck is $24 and includes this digital unlock. <a href="https://familypause.com/cards" target="_blank" rel="noreferrer" style={{ color: T.terra }}>Get the full deck →</a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DECK LIBRARY: owned decks + new year awareness
// ─────────────────────────────────────────────────────────────────────────────
function DeckLibrary({ workspace, onClose, onUnlock }) {
  const unlockedYears = workspace?.unlocked_deck_years || [];
  const currentYear = new Date().getFullYear();
  const availableNewYears = Object.keys(DECKS)
    .map(Number)
    .filter(y => y > Math.max(...(unlockedYears.length ? unlockedYears : [2025])));

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Lora', serif" }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "18px 24px", display: "flex", alignItems: "center", gap: 14, background: T.bg }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 20 }}>←</button>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>MY CARDS</div>
          <div style={{ fontSize: 20, color: T.text, fontFamily: "'Playfair Display', serif" }}>Card Deck Library</div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "28px 24px 80px" }}>

        {/* Owned decks */}
        {unlockedYears.length > 0 ? (
          <>
            <div style={{ fontSize: 11, color: T.muted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>
              Your Decks
            </div>
            {unlockedYears.sort((a, b) => b - a).map(year => {
              const deck = DECKS[year];
              if (!deck) return null;
              return (
                <div key={year} className="deck-card" style={{
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderLeft: `4px solid ${T.terra}`,
                  borderRadius: 14, padding: "22px 24px", marginBottom: 14,
                  transition: "all 0.2s", cursor: "default",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: T.text }}>{year} Deck</div>
                        <div style={{ background: T.oliveL, color: T.olive, border: `1px solid ${T.olive}33`, borderRadius: 20, padding: "2px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.08em" }}>
                          ✓ UNLOCKED
                        </div>
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.muted, letterSpacing: "0.05em", marginBottom: 8 }}>
                        {deck.theme}
                      </div>
                      <div style={{ fontSize: 14, color: T.mid, fontStyle: "italic" }}>{deck.tagline}</div>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, color: T.terraL, fontWeight: 400, flexShrink: 0, marginLeft: 16 }}>
                      {deck.cards.length}
                    </div>
                  </div>

                  {/* Category breakdown */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                    {Object.entries(
                      deck.cards.reduce((acc, c) => { acc[c.category] = (acc[c.category] || 0) + 1; return acc; }, {})
                    ).map(([cat, count]) => {
                      const col = CAT_COLORS[cat] || CAT_COLORS.Home;
                      return (
                        <div key={cat} style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}33`, padding: "3px 10px", borderRadius: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.05em" }}>
                          {cat} · {count}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 12, fontSize: 12, color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                    These cards are yours permanently. No expiration.
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 0", marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🃏</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: T.text, marginBottom: 8 }}>No decks yet</div>
            <div style={{ fontSize: 15, color: T.mid, lineHeight: 1.6 }}>Get the FamilyPause Card Deck to unlock the weekly card draw feature.</div>
          </div>
        )}

        {/* New year awareness cards */}
        {availableNewYears.map(year => {
          const deck = DECKS[year];
          if (!deck?.available) return null;
          return (
            <div key={year} style={{ marginTop: 24 }}>
              <div style={{ fontSize: 11, color: T.muted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 14 }}>
                New This Year
              </div>
              <div style={{
                background: `linear-gradient(135deg, ${T.terraL} 0%, ${T.goldL} 100%)`,
                border: `1px solid ${T.terra}33`,
                borderRadius: 16, padding: "28px 24px",
                position: "relative", overflow: "hidden",
              }}>
                {/* Decorative */}
                <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(190,90,55,0.08)", pointerEvents: "none" }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.terra, letterSpacing: "0.2em", marginBottom: 8 }}>
                      {year} DECK AVAILABLE
                    </div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: T.text, marginBottom: 6 }}>
                      {year}: {deck.theme}
                    </div>
                    <div style={{ fontSize: 14, color: T.mid, fontStyle: "italic", lineHeight: 1.5 }}>
                      {deck.tagline}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: T.mid, lineHeight: 1.6, marginBottom: 20 }}>
                  Your {unlockedYears[0] || "existing"} cards never expire. Keep using them as long as you like. The {year} deck is here whenever you're ready for fresh questions.
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={onUnlock} style={{
                    background: T.terra, color: T.bg,
                    border: "none", borderRadius: 8,
                    padding: "10px 20px", cursor: "pointer",
                    fontFamily: "'Lora', serif", fontSize: 15,
                    transition: "all 0.15s",
                    boxShadow: `0 4px 12px rgba(190,90,55,0.25)`,
                  }}>
                    Get the {year} Deck →
                  </button>
                  <a href="https://familypause.com/cards" target="_blank" rel="noreferrer" style={{
                    background: "transparent",
                    border: `1px solid ${T.terra}44`,
                    borderRadius: 8, padding: "10px 20px",
                    color: T.terraD, fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12, letterSpacing: "0.05em",
                    textDecoration: "none", transition: "all 0.15s",
                  }}>
                    See the physical deck
                  </a>
                </div>
              </div>
            </div>
          );
        })}

        {/* No new decks available */}
        {availableNewYears.length === 0 && unlockedYears.length > 0 && (
          <div style={{ marginTop: 28, padding: "20px 24px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>
              You're up to date. New decks drop each January.
            </div>
          </div>
        )}

        {/* Add another deck */}
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <button onClick={onUnlock} style={{ background: "none", border: "none", color: T.terra, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.08em", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
            + Enter another deck code
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CARD SYSTEM ROOT: main export
// ─────────────────────────────────────────────────────────────────────────────
export default function CardSystemRoot({ workspace, meetingDate, onStartSession, onClose, onSkip, initialView = "draw", onWorkspaceUpdate }) {
  const [view, setView] = useState(initialView); // draw | unlock | library
  const enteredUnlockFromDraw = useRef(false);
  const skipSession = onSkip || onClose;

  // Sync workspace state after unlock
  const [localWorkspace, setLocalWorkspace] = useState(workspace);

  useEffect(() => { setLocalWorkspace(workspace); }, [workspace]);
  useEffect(() => {
    setView(initialView);
    enteredUnlockFromDraw.current = false;
  }, [initialView]);

  const handleUnlockBack = () => {
    if (enteredUnlockFromDraw.current) {
      setView("draw");
      enteredUnlockFromDraw.current = false;
    } else {
      onClose();
    }
  };

  const handleUnlockSuccess = async (deckYear) => {
    // Refetch workspace to get updated unlocked status
    const { data } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspace.id)
      .single();
    if (data) {
      setLocalWorkspace(data);
      onWorkspaceUpdate?.(data);
    }
    setView("draw");
  };

  return (
    <>
      {view === "draw" && (
        <CardDraw
          workspace={localWorkspace}
          meetingDate={meetingDate}
          onStartSession={onStartSession}
          onSkip={skipSession}
          onUnlock={() => {
            enteredUnlockFromDraw.current = true;
            setView("unlock");
          }}
        />
      )}
      {view === "unlock" && (
        <UnlockDeck
          workspace={localWorkspace}
          onSuccess={handleUnlockSuccess}
          onClose={handleUnlockBack}
        />
      )}
      {view === "library" && (
        <DeckLibrary
          workspace={localWorkspace}
          onClose={() => setView("draw")}
          onUnlock={() => setView("unlock")}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION: how to use CardSystemRoot in App.jsx
// ─────────────────────────────────────────────────────────────────────────────
//
// In your main App.jsx, when the user taps "Begin This Week's Sync":
//
//   const [showCards, setShowCards] = useState(false);
//   const [sessionCard, setSessionCard] = useState(null);
//
//   // Replace the Begin button with:
//   <button onClick={() => setShowCards(true)}>
//     Begin This Week's Sync
//   </button>
//
//   // Render CardSystemRoot as an overlay:
//   {showCards && (
//     <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
//       <CardSystemRoot
//         workspace={workspace}
//         onStartSession={(card) => {
//           setSessionCard(card);   // save the card with the session
//           setShowCards(false);
//           setPhase(PHASE.INPUT);  // go to input screen
//         }}
//         onClose={() => {
//           setShowCards(false);
//           setPhase(PHASE.INPUT);  // skip card, go straight to input
//         }}
//       />
//     </div>
//   )}
//
// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE: add these columns to your workspaces table
// ─────────────────────────────────────────────────────────────────────────────
//
//   alter table workspaces
//     add column cards_unlocked boolean default false,
//     add column unlocked_deck_years integer[] default '{}',
//     add column deck_unlocked_at timestamptz;
//
//   create table deck_codes (
//     id           uuid primary key default gen_random_uuid(),
//     code         text unique not null,
//     deck_year    integer default 2026,
//     batch        text,
//     redeemed_by  uuid references auth.users(id),
//     redeemed_at  timestamptz,
//     created_at   timestamptz default now()
//   );
//
//   -- Insert test code for development:
//   insert into deck_codes (code, deck_year, batch)
//   values ('FP-2026-TEST-0001', 2026, 'dev-test');
