import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const chromeCss = `
.fp-mkt {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #FAF7F2;
  color: var(--ink);
  font-family: var(--serif);
  -webkit-font-smoothing: antialiased;
}
.fp-mkt * { box-sizing: border-box; }
.fp-mkt a { color: inherit; text-decoration: none; }
.fp-mkt .wrap {
  width: min(1120px, calc(100% - 48px));
  margin: 0 auto;
}
.fp-mkt .nav {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(250, 247, 242, .88);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid transparent;
  transition: border-color .2s, background .2s;
}
.fp-mkt .nav.scrolled {
  border-bottom-color: var(--line);
  background: rgba(250, 247, 242, .96);
}
.fp-mkt .nav .row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 74px;
}
.fp-mkt .logo {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.fp-mkt .logo .word {
  font-family: var(--display);
  font-size: 22px;
  font-weight: 600;
}
.fp-mkt .logo .word b { color: var(--terra); }
.fp-mkt .navlinks {
  display: flex;
  align-items: center;
  gap: 26px;
}
.fp-mkt .navlinks a {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--ink-2);
  white-space: nowrap;
}
.fp-mkt .navlinks a:hover { color: var(--terra); }
.fp-mkt .navcta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}
.fp-mkt .navcta .signin {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--ink-2);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
}
.fp-mkt .navcta .signin:hover { color: var(--terra); }
.fp-mkt .btn {
  font-family: var(--mono);
  text-transform: uppercase;
  letter-spacing: .07em;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 7px;
  padding: 15px 26px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  transition: transform .12s, box-shadow .22s, background .2s;
  white-space: nowrap;
}
.fp-mkt .btn-primary {
  background: var(--terra);
  color: #fff;
  box-shadow: 0 8px 20px rgba(190, 90, 55, .26);
}
.fp-mkt .btn-primary:hover { background: var(--terra-d); }
.fp-mkt .btn-block { width: 100%; justify-content: center; }
.fp-mkt .navmenu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  padding: 0;
}
.fp-mkt .navmobile {
  display: none;
  position: fixed;
  inset: 74px 0 0 0;
  background: rgba(42, 37, 29, .28);
  z-index: 39;
}
.fp-mkt .navmobile.open { display: block; }
.fp-mkt .navmobile-panel {
  background: #FAF7F2;
  border-bottom: 1px solid var(--line);
  padding: 20px 24px 28px;
}
.fp-mkt .navmobile-links {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 20px;
}
.fp-mkt .navmobile-links a {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--ink-2);
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.fp-mkt .navmobile-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fp-mkt .navmobile-actions .signin {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--ink-2);
  background: none;
  border: none;
  padding: 8px 0;
  cursor: pointer;
  text-align: left;
}
.fp-mkt .fp-mkt-main { flex: 1 0 auto; }
.fp-mkt .foot {
  border-top: 1px solid var(--line-2);
  background: var(--paper-2);
  padding: 54px 0 60px;
  margin-top: auto;
}
.fp-mkt .foot .row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 30px;
  flex-wrap: wrap;
}
.fp-mkt .foot .word {
  font-family: var(--display);
  font-size: 26px;
  font-weight: 600;
}
.fp-mkt .foot .word b { color: var(--terra); }
.fp-mkt .foot .tag {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--ink-3);
  line-height: 1.4;
  margin-top: 8px;
  max-width: none;
  white-space: nowrap;
}
.fp-mkt .foot .fcols { display: flex; gap: 64px; flex-wrap: wrap; }
.fp-mkt .foot .fcol h4 {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin: 0 0 14px;
  font-weight: 500;
}
.fp-mkt .foot .fcol a {
  display: block;
  font-size: 14.5px;
  color: var(--ink-2);
  margin-bottom: 9px;
  transition: color .15s;
}
.fp-mkt .foot .fcol a:hover { color: var(--terra); }
.fp-mkt .fp-footer-link {
  display: block;
  font-size: 14.5px;
  color: var(--ink-2);
  margin-bottom: 9px;
  transition: color .15s;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}
.fp-mkt .fp-footer-link:hover { color: var(--terra); }
.fp-mkt .foot .legal {
  margin-top: 44px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
  font-size: 13px;
  color: var(--ink-3);
}
@media (max-width: 900px) {
  .fp-mkt .navlinks,
  .fp-mkt .navcta .signin,
  .fp-mkt .navcta .btn:not(.navmenu-btn) { display: none; }
  .fp-mkt .navmenu-btn { display: inline-flex; }
  .fp-mkt .foot .fcols { gap: 36px; }
  .fp-mkt .foot .tag {
    white-space: normal;
    font-size: 9px;
  }
}
`;

/**
 * Shared marketing header + footer (same structure as the landing page).
 */
export default function MarketingChrome({ children }) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onSignIn = () => navigate("/app", { replace: true });
  const onStart = () => navigate("/app?signup=1", { replace: true });

  return (
    <div className="fp-mkt">
      <style>{chromeCss}</style>

      <header className={"nav" + (scrolled ? " scrolled" : "")}>
        <div className="wrap row">
          <a className="logo" href="/">
            <img
              src="/uploads/Logo_4.png"
              alt="FamilyPause"
              style={{ height: 36, width: 36, borderRadius: 8, display: "block" }}
            />
            <span className="word"><b>Family</b>Pause</span>
          </a>
          <nav className="navlinks">
            <a href="/#how">How It Works</a>
            <a href="/#who">Who It&apos;s For</a>
            <a href="/#pricing">Pricing</a>
            <a href="/#deck">Card Deck</a>
            <a href="/blog">Blog</a>
          </nav>
          <div className="navcta">
            <button type="button" className="signin" onClick={onSignIn}>Sign In</button>
            <button type="button" className="btn btn-primary" onClick={onStart}>Create My Plan</button>
            <button
              type="button"
              className="navmenu-btn"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} strokeWidth={2}>
                {mobileNavOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
        <div
          className={"navmobile" + (mobileNavOpen ? " open" : "")}
          onClick={() => setMobileNavOpen(false)}
        >
          <nav className="navmobile-panel" onClick={(e) => e.stopPropagation()}>
            <div className="navmobile-links">
              <a href="/#how" onClick={() => setMobileNavOpen(false)}>How It Works</a>
              <a href="/#who" onClick={() => setMobileNavOpen(false)}>Who It&apos;s For</a>
              <a href="/#pricing" onClick={() => setMobileNavOpen(false)}>Pricing</a>
              <a href="/#deck" onClick={() => setMobileNavOpen(false)}>Card Deck</a>
              <a href="/blog" onClick={() => setMobileNavOpen(false)}>Blog</a>
            </div>
            <div className="navmobile-actions">
              <button
                type="button"
                className="signin"
                onClick={() => { setMobileNavOpen(false); onSignIn(); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => { setMobileNavOpen(false); onStart(); }}
              >
                Create My Plan
              </button>
            </div>
          </nav>
        </div>
      </header>

      <div className="fp-mkt-main">{children}</div>

      <footer className="foot">
        <div className="wrap">
          <div className="row">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <img
                  src="/uploads/Logo_4.png"
                  alt=""
                  style={{ width: 32, height: 32, borderRadius: 8, display: "block" }}
                />
                <div className="word"><b>Family</b>Pause</div>
              </div>
              <div className="tag">So much going on. One plan to move forward with.</div>
            </div>
            <div className="fcols">
              <div className="fcol">
                <h4>Product</h4>
                <a href="/#how">How It Works</a>
                <a href="/#who">Who It&apos;s For</a>
                <a href="/#pricing">Pricing</a>
                <a href="/#deck">Card Deck</a>
              </div>
              <div className="fcol">
                <h4>Company</h4>
                <a href="/blog">Blog</a>
                <a href="/privacy.html">Privacy</a>
                <a href="/terms.html">Terms</a>
                <a href="/contact">Contact</a>
              </div>
              <div className="fcol">
                <h4>Get Started</h4>
                <button type="button" className="fp-footer-link" onClick={onSignIn}>Sign In</button>
                <button type="button" className="fp-footer-link" onClick={onStart}>
                  Create My Family Plan
                </button>
              </div>
            </div>
          </div>
          <div className="legal fineprint">
            © 2026 FamilyPause · Built with intention ·{" "}
            <a
              href="https://www.biblegateway.com/passage/?search=Ecclesiastes%204%3A9-12&version=NASB"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Ecclesiastes 4:9
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
