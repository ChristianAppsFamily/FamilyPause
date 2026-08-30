import { useNavigate } from "react-router-dom";
import { useAuthSession } from "../lib/useAuthSession";

/**
 * Marketing header CTA: Sign In (signed out) or Continue → /app (signed in).
 * Loading uses a same-size hidden Sign In so the header does not jump.
 */
export default function AuthHeaderCta({
  onSignIn,
  className = "btn btn-primary",
  footerClassName = "fp-footer-link",
  variant = "button",
  onNavigate,
}) {
  const auth = useAuthSession();
  const navigate = useNavigate();

  const goApp = () => {
    onNavigate?.();
    navigate("/app");
  };

  const resolvedClass = variant === "footer" ? footerClassName : className;

  if (auth === "loading") {
    if (variant === "footer") return null;
    return (
      <button type="button" className={resolvedClass + " auth-cta-placeholder"} disabled tabIndex={-1} aria-hidden="true">
        Sign In
      </button>
    );
  }

  if (auth === "signedIn") {
    return (
      <button type="button" className={resolvedClass} onClick={goApp}>
        Continue
      </button>
    );
  }

  return (
    <button
      type="button"
      className={resolvedClass}
      onClick={() => {
        onNavigate?.();
        onSignIn();
      }}
    >
      Sign In
    </button>
  );
}
