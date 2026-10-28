// Shared marketing nav + footer. Render inside an element with class "fp-site"
// (src/styles/site.css) — Landing wraps the whole page; MarketingChrome wraps only
// the chrome so inner page styles are untouched.

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthHeaderCta from "./AuthHeaderCta.jsx";
import "../styles/site.css";

/** Two emerald pills tilted 6° outward, sun dots above — two people / a pause. */
export function FpMark({
  size = 29,
  fill = "#14805E",
  head = "#FFB547",
  style,
  className,
}) {
  const height = size;
  const width = Math.round((size * 25) / 29);
  return (
    <svg
      viewBox="0 0 25 29"
      width={width}
      height={height}
      aria-hidden="true"
      style={style}
      className={className}
    >
      <g transform="rotate(-6 6 20)">
        <circle cx="6" cy="5" r="4" fill={head} />
        <rect x="2" y="11" width="8" height="18" rx="5" fill={fill} />
      </g>
      <g transform="rotate(6 19 20)">
        <circle cx="19" cy="5" r="4" fill={head} />
        <rect x="15" y="11" width="8" height="18" rx="5" fill={fill} />
      </g>
    </svg>
  );
}

export function FpLogo({ white = false, size = 29 }) {
  return (
    <>
      <FpMark size={size} fill={white ? "#fff" : "#14805E"} />
      <span>Family<span>Pause</span></span>
    </>
  );
}

function ShieldIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 8 3v6c0 5-8 10-8 10S4 17 4 12V6Z" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

function MenuIcon({ open }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {open ? (
        <>
          <path d="m6 6 12 12M6 18 18 6" />
        </>
      ) : (
        <>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </>
      )}
    </svg>
  );
}

/** Returns an onClick factory for landing-section links (/#how-it-works etc.). */
function useSectionLink(onSection, closeMenu) {
  const navigate = useNavigate();
  return (id) => (event) => {
    event.preventDefault();
    closeMenu?.();
    if (onSection) onSection(id);
    else navigate(`/#${id}`);
  };
}

function HomeLogo({ onHome, closeMenu }) {
  const handle = (event) => {
    closeMenu?.();
    if (onHome) {
      event.preventDefault();
      onHome();
    }
  };
  if (onHome) {
    return (
      <a href="/" className="logo" aria-label="FamilyPause home" onClick={handle}>
        <FpLogo />
      </a>
    );
  }
  return (
    <Link to="/" className="logo" aria-label="FamilyPause home" onClick={closeMenu}>
      <FpLogo />
    </Link>
  );
}

export function SiteNav({ onSignIn, onStart, onSection, onHome }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const section = useSectionLink(onSection, closeMenu);

  return (
    <header className="site-nav">
      <div className="nav-inner">
        <HomeLogo onHome={onHome} closeMenu={closeMenu} />
        <nav className={`nav-links${menuOpen ? " open" : ""}`} aria-label="Main navigation">
          <a href="/#how-it-works" onClick={section("how-it-works")}>How It Works</a>
          <a href="/#conversation-cards" onClick={section("conversation-cards")}>Conversation Cards</a>
          <a href="/#pricing" onClick={section("pricing")}>Pricing</a>
          <a href="/#concierge" onClick={section("concierge")}>Concierge</a>
          <Link to="/blog" onClick={closeMenu}>Blog</Link>
        </nav>
        <div className="nav-actions">
          <AuthHeaderCta onSignIn={onSignIn} className="" signInLabel="Log in" onNavigate={closeMenu} />
          <button type="button" className="btn primary" onClick={() => { closeMenu(); onStart(); }}>
            Start Free
          </button>
        </div>
        <button
          type="button"
          className="menu-button icon-button"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MenuIcon open={menuOpen} />
        </button>
      </div>
    </header>
  );
}

export function SiteFooter({ onSection, onHome }) {
  const section = useSectionLink(onSection);
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <HomeLogo onHome={onHome} />
            <p>A little less mental load.<br />A little more life, together.</p>
          </div>
          <div className="footer-column">
            <h3>How FamilyPause Helps</h3>
            <a href="/#how-it-works" onClick={section("how-it-works")}>Plan the week</a>
            <a href="/#conversation-cards" onClick={section("conversation-cards")}>Stay connected as parents</a>
            <a href="/#how-it-works" onClick={section("how-it-works")}>Share the load</a>
            <a href="/#for-you" onClick={section("for-you")}>Build family rhythms</a>
          </div>
          <div className="footer-column">
            <h3>Product</h3>
            <a href="/#how-it-works" onClick={section("how-it-works")}>How it works</a>
            <a href="/#conversation-cards" onClick={section("conversation-cards")}>Conversation Cards</a>
            <a href="/#pricing" onClick={section("pricing")}>Pricing</a>
            <a href="/#concierge" onClick={section("concierge")}>Concierge</a>
          </div>
          <div className="footer-column">
            <h3>Company</h3>
            <Link to="/contact">About</Link>
            <Link to="/contact">Gift FamilyPause</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/blog">Blog</Link>
          </div>
          <div className="footer-column">
            <h3>Help</h3>
            <Link to="/contact">FAQ</Link>
            <a href="/privacy.html">Privacy</a>
            <a href="/terms.html">Terms</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>FamilyPause is a product of Christian App Empire LLC.</span>
          <span className="footer-trust"><ShieldIcon />Ad-free. We never sell your family&apos;s information.</span>
          <span>© 2026 FamilyPause</span>
        </div>
      </div>
    </footer>
  );
}
