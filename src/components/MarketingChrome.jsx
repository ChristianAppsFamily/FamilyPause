import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { goToSignIn, goToSignUp } from "../lib/routes";
import { SiteFooter, SiteNav } from "./SiteChrome.jsx";

const chromeCss = `
.fp-mkt {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  color: var(--ink);
  font-family: var(--serif);
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}
.fp-mkt * { box-sizing: border-box; }
.fp-mkt a:not(.btn) { color: inherit; }
.fp-mkt a { text-decoration: none; }
.fp-mkt .fp-mkt-main { flex: 1 0 auto; }
.fp-mkt .fp-site.fp-chrome {
  min-height: 0;
  overflow: visible;
  background: transparent;
}
.fp-mkt .fp-chrome-nav { position: sticky; top: 0; z-index: 50; }
.fp-mkt .fp-chrome-nav .site-nav { position: relative; }
.fp-mkt .fp-chrome-foot { margin-top: 72px; }
.fp-mkt .fp-site.fp-chrome .footer-column a:hover { color: var(--green); }
`;

/**
 * Shared marketing header + footer (same nav and footer as the landing page).
 */
export default function MarketingChrome({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.body.classList.add("fp-site-page");
    return () => document.body.classList.remove("fp-site-page");
  }, []);

  const onSignIn = () => goToSignIn(navigate, location);
  const onStart = () => goToSignUp(navigate, location);

  return (
    <div className="fp-mkt">
      <style>{chromeCss}</style>
      <div className="fp-site fp-chrome fp-chrome-nav">
        <SiteNav onSignIn={onSignIn} onStart={onStart} />
      </div>
      <div className="fp-mkt-main">{children}</div>
      <div className="fp-site fp-chrome fp-chrome-foot">
        <SiteFooter />
      </div>
    </div>
  );
}
