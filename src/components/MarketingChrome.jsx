import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { goToSignIn, goToSignUp } from "../lib/routes";
import AuthHeaderCta from "./AuthHeaderCta";

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
  font-weight: 400;
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
.fp-mkt .logo img {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: block;
  flex-shrink: 0;
}
.fp-mkt .logo .word {
  font-family: var(--display);
  font-size: 21px;
  font-weight: 600;
  line-height: 1;
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
.fp-mkt .navcta .auth-cta-placeholder {
  visibility: hidden;
  pointer-events: none;
}
.fp-mkt .btn {
  font-family: var(--serif);
  text-transform: none;
  letter-spacing: 0;
  font-size: 15px;
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
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 0;
  background: none;
  color: var(--ink);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
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
.fp-mkt .foot .brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.fp-mkt .foot .brand-row {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  line-height: 1;
}
.fp-mkt .foot .brand-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
.fp-mkt .foot .brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: block;
  flex-shrink: 0;
  object-fit: contain;
}
.fp-mkt .foot .word {
  font-family: var(--display);
  font-size: 22px;
  font-weight: 600;
  line-height: 1;
  margin-top: -1px;
}
.fp-mkt .foot .word b { color: var(--terra); }
.fp-mkt .foot .brand-tag {
  font-family: var(--serif);
  font-style: italic;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: var(--ink-2);
  line-height: 1.15;
  margin: 0;
  padding: 0;
  max-width: none;
  white-space: nowrap;
  display: block;
  border-radius: 0;
  background: none;
}
.fp-mkt .foot .fcols { display: flex; gap: 64px; flex-wrap: wrap; }
.fp-mkt .foot .fcol h4 {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--terra);
  margin: 0 0 14px;
  font-weight: 600;
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
  font-family: var(--serif);
  font-size: 15.5px;
  font-weight: 400;
  line-height: 1.55;
  color: var(--ink-2);
}
@media (max-width: 900px) {
  .fp-mkt .navlinks,
  .fp-mkt .navcta .signin,
  .fp-mkt .navcta .btn:not(.navmenu-btn) { display: none; }
  .fp-mkt .navmenu-btn { display: inline-flex; }
  .fp-mkt .navcta { margin-left: auto; }
  .fp-mkt .foot .fcols { gap: 36px; }
  .fp-mkt .foot .brand-tag {
    white-space: normal;
    font-size: 14px;
  }
}
`;

/**
 * Shared marketing header + footer (same structure as the landing page).
 */
export default function MarketingChrome({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onSignIn = () => goToSignIn(navigate, location);
  const onStart = () => goToSignUp(navigate, location);

  return (
    <div className="fp-mkt">
      <style>{chromeCss}</style>

      <header className={"nav" + (scrolled ? " scrolled" : "")}>
        <div className="wrap row">
          <a className="logo" href="/">
            <img
              src="/uploads/Logo_4.png"
              alt="FamilyPause"
            />
            <span className="word"><b>Family</b>Pause</span>
          </a>
          <nav className="navlinks">
            <a href="/#how">How It Works</a>
            <a href="/#who">Who It&apos;s For</a>
            <a href="/#deck">Conversation Cards</a>
            <a href="/#pricing">Pricing</a>
          </nav>
          <div className="navcta">
            <AuthHeaderCta onSignIn={onSignIn} />
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
              <a href="/#deck" onClick={() => setMobileNavOpen(false)}>Conversation Cards</a>
              <a href="/#pricing" onClick={() => setMobileNavOpen(false)}>Pricing</a>
            </div>
            <div className="navmobile-actions">
              <AuthHeaderCta
                onSignIn={onSignIn}
                className="btn btn-primary btn-block"
                onNavigate={() => setMobileNavOpen(false)}
              />
            </div>
          </nav>
        </div>
      </header>

      <div className="fp-mkt-main">{children}</div>

      <footer className="foot">
        <div className="wrap">
          <div className="row">
            <div className="brand">
              <div className="brand-row">
                <img className="brand-mark" src="/uploads/Logo_4.png" alt="" />
                <div className="brand-copy">
                  <div className="word"><b>Family</b>Pause</div>
                  <div className="brand-tag">Less Chaos. More Time.</div>
                </div>
              </div>
            </div>
            <div className="fcols">
              <div className="fcol">
                <h4>Product</h4>
                <a href="/#how">How It Works</a>
                <a href="/#who">Who It&apos;s For</a>
                <a href="/#deck">Conversation Cards</a>
                <a href="/#pricing">Pricing</a>
                <a href="/mobile">Mobile Apps</a>
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
                <AuthHeaderCta variant="footer" footerClassName="fp-footer-link" onSignIn={onSignIn} />
                <button type="button" className="fp-footer-link" onClick={onStart}>
                  Start My Free Trial
                </button>
              </div>
            </div>
          </div>
          <div className="legal">
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
