import { useCallback, useEffect, useRef, useState } from 'react';
import {
  callLandingDemoAI,
  DEMO_MAX_CHARS,
  DEMO_MIN_LOADING_MS,
  formatDemoWhen,
  getLoadingMessage,
  isDemoLimited,
  markDemoUsed,
  personRole,
  TOPIC_SAMPLES,
} from '../lib/landingDemo';

const PLACEHOLDER =
  'Try something like... "We need to take Jordan to the dentist Thursday, follow up with the accountant before month end, and figure out the summer camp situation for the kids."';

function FpMark() {
  return (
    <span className="fpmark" aria-hidden="true">
      <span className="pillgrp"><span className="dot" /><span className="pill" /></span>
      <span className="pillgrp"><span className="dot" /><span className="pill" /></span>
    </span>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };

function DemoCard({ card, index, visible }) {
  const role = personRole(card.person);
  const isEvent = card.type === 'event';
  const when = formatDemoWhen(card.date, card.time, card.type);
  const roleClass = role === 'amanda' ? 'olive' : role === 'both' ? 'gold' : '';
  const personTag = role === 'spence' ? 'spence' : role === 'amanda' ? 'amanda' : 'both';

  return (
    <div
      className={`democard mcard ${roleClass} ${visible ? 'in' : ''}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="mtags">
        <span className={`mtag ${personTag}`}>{card.person}</span>
        <span className="mtag cat">{card.category}</span>
      </div>
      <div className="mt">{card.task}</div>
      {card.source && <div className="mq">&ldquo;{card.source}&rdquo;</div>}
      {when && (
        <div className="mwhen">
          <svg width="12" height="12" viewBox="0 0 24 24" {...stroke} strokeWidth={2}>
            <path d="M7 3v3M17 3v3M4 8h16" />
            <path d="M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
          </svg>
          {when}
        </div>
      )}
      <div className="macts demo-static" aria-hidden="true">
        <span className="mbtn keep">Keep</span>
        {isEvent ? (
          <span className="mbtn cal">+ Calendar</span>
        ) : (
          <span className="mbtn disc">Discard</span>
        )}
      </div>
    </div>
  );
}

function ConversionBand({ onStart, onSeePricing }) {
  return (
    <div className="conv">
      <h3>This is what FamilyPause does <em>every week</em>.</h3>
      <p className="convlead">
        The full app records your conversation live, extracts everything, and lets you review together. Your week planned in minutes.
      </p>
      <div className="convbtns">
        <button type="button" className="btn btn-primary" onClick={onStart}>Start Free, 7 Days</button>
        <button type="button" className="btn btn-ghost" onClick={onSeePricing}>See Pricing</button>
      </div>
      <p className="convnote">No credit card required. Takes 60 seconds to set up.</p>
    </div>
  );
}

export default function LandingDemo({ onStart = () => {}, onSeePricing }) {
  const scrollToPricing = useCallback(() => {
    if (onSeePricing) {
      onSeePricing();
      return;
    }
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [onSeePricing]);

  const [phase, setPhase] = useState(() => (isDemoLimited() ? 'limited' : 'input'));
  const [text, setText] = useState('');
  const [showPills, setShowPills] = useState(true);
  const [cards, setCards] = useState([]);
  const [error, setError] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [progress, setProgress] = useState(0);
  const [cardsVisible, setCardsVisible] = useState(false);
  const timersRef = useRef([]);
  const rafRef = useRef(null);

  const len = text.length;
  const canDistill = len > 0 && phase === 'input';
  const counterClass = len >= DEMO_MAX_CHARS ? 'at-max' : len >= 400 ? 'warn' : '';

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const handleInput = (e) => {
    setText(e.target.value);
    setError(null);
    if (showPills) setShowPills(false);
  };

  const handleTopic = (topic) => {
    const sample = TOPIC_SAMPLES[topic];
    if (sample) {
      setText(sample.slice(0, DEMO_MAX_CHARS));
      setShowPills(false);
      setError(null);
    }
  };

  const runLoadingAnimation = useCallback(() => {
    const start = performance.now();
    const duration = 8000;

    setLoadingMsg(0);
    setProgress(0);

    timersRef.current.push(
      setTimeout(() => setLoadingMsg(1), 3000),
      setTimeout(() => setLoadingMsg(2), 6000),
    );

    const tick = (now) => {
      const elapsed = now - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (elapsed < duration) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      clearTimers();
      setProgress(100);
    };
  }, [clearTimers]);

  const handleDistill = async () => {
    if (!canDistill) return;
    clearTimers();
    setError(null);
    setPhase('loading');
    setCards([]);
    setCardsVisible(false);

    const loadStart = Date.now();
    const finishProgress = runLoadingAnimation();

    let apiCards = null;
    let apiError = null;

    try {
      apiCards = await callLandingDemoAI(text);
    } catch (err) {
      apiError = err?.message || 'Distill unavailable. Try again in a moment.';
    }

    const wait = Math.max(0, DEMO_MIN_LOADING_MS - (Date.now() - loadStart));
    await new Promise((r) => setTimeout(r, wait));

    finishProgress();

    if (apiError || !apiCards?.length) {
      setPhase('input');
      setProgress(0);
      setLoadingMsg(0);
      setError(apiError || 'No items found. Try pasting a bit more detail.');
      return;
    }

    markDemoUsed();
    setCards(apiCards);
    setPhase('results');
    timersRef.current.push(setTimeout(() => setCardsVisible(true), 80));
  };

  return (
    <section className="trysec" id="try">
      <div className="trywrap">
        <div className="tryhead reveal">
          <span className="eyebrow demo-eyebrow">Try It Now!</span>
          <h2>See what FamilyPause<br /><em>does</em>.</h2>
          <p className="lead">
            Paste a few sentences from a real family conversation, anything you have talked about recently. Hit Distill and watch the AI organize it in seconds.
          </p>
          <p className="note">No account needed. One free try per day.</p>
        </div>

        {phase === 'limited' && (
          <div className="trylimit">
            <div className="limitbox">
              <div className="llabel">One demo per day</div>
              <p className="lbody">You have already tried FamilyPause today. Ready to see the full experience?</p>
              <div className="convbtns">
                <button type="button" className="btn btn-primary" onClick={onStart}>Start Free, 7 Days</button>
                <button type="button" className="btn btn-ghost" onClick={scrollToPricing}>See Pricing</button>
              </div>
            </div>
          </div>
        )}

        {(phase === 'input' || phase === 'loading') && (
          <>
            <div className={`tryio ${phase === 'loading' ? 'loading' : ''}`}>
              <textarea
                className="tryta"
                value={text}
                onChange={handleInput}
                maxLength={DEMO_MAX_CHARS}
                placeholder={PLACEHOLDER}
                disabled={phase === 'loading'}
                rows={6}
              />
              <div className="tryrow">
                <span className={`trycount ${counterClass}`}>{len} / {DEMO_MAX_CHARS}</span>
                <button
                  type="button"
                  className={`distill ${canDistill ? 'active' : ''} ${phase === 'loading' ? 'is-loading' : ''}`}
                  onClick={handleDistill}
                  disabled={!canDistill || phase === 'loading'}
                >
                  <FpMark />
                  <span className="dtext">Distill It</span>
                  <span className="dloader" aria-hidden="true">
                    <span className="ld" /><span className="ld" /><span className="ld" />
                  </span>
                </button>
              </div>
              {len >= DEMO_MAX_CHARS && (
                <p className="trymax">Maximum length reached</p>
              )}
              {error && (
                <div className="tryerr">
                  <p>{error}</p>
                  <button type="button" className="tryretry" onClick={handleDistill}>Try again</button>
                </div>
              )}
              <div className={`tryprog ${phase === 'loading' ? 'show' : ''}`}>
                <div className="progtrack">
                  <div className="progfill" style={{ width: `${progress}%` }} />
                </div>
                <p className="progstatus">{getLoadingMessage(loadingMsg)}</p>
              </div>
            </div>

            {showPills && phase === 'input' && (
              <div className="tryex">
                <p className="exlead">Not sure what to paste? Try one of these topics.</p>
                <div className="exrow">
                  {Object.keys(TOPIC_SAMPLES).map((topic) => (
                    <button key={topic} type="button" className="expill" onClick={() => handleTopic(topic)}>
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {phase === 'results' && (
          <div className="tryresults show">
            <hr className="resrule" />
            <div className="reslabel">
              Your FamilyPause distill
              <span className="chk" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5 10 17.5 19.5 6.5" />
                </svg>
              </span>
            </div>
            <div className="rescards">
              {cards.map((card, i) => (
                <DemoCard key={card.id} card={card} index={i} visible={cardsVisible} />
              ))}
            </div>
            <ConversionBand onStart={onStart} onSeePricing={scrollToPricing} />
          </div>
        )}
      </div>
    </section>
  );
}
