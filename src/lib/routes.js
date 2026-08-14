/** URL helpers — keep browser back/forward aligned with in-app screens */

export const SYNC_VIEWS = ["agenda", "capture", "processing", "resolve", "review", "plan"];

export function onboardingPath(step) {
  return `/app/onboarding/${step}`;
}

export function syncPath(view = "agenda") {
  return `/app/sync/${view}`;
}

export function cardsPath(view = "draw") {
  if (view === "library" || view === "unlock") return `/app/cards?view=${view}`;
  return "/app/cards";
}

export function subscribeSuccessPath(sessionId = "") {
  if (sessionId) return `/app/subscribe/success?session_id=${encodeURIComponent(sessionId)}`;
  return "/app/subscribe/success";
}

export function authPathForScreen(screen, inviteCode = "", email = "") {
  switch (screen) {
    case "signup":
      return "/app?signup=1";
    case "forgot":
      return "/app?forgot=1";
    case "join":
      return inviteCode ? `/join/${inviteCode}` : "/app?join=1";
    case "signin":
    default:
      return email ? `/app?email=${encodeURIComponent(email)}` : "/app";
  }
}

function isAuthPath(path) {
  return !path || path === "/app" || path.startsWith("/app") || path.startsWith("/join");
}

/** Remember the marketing page so Sign In / Sign Up can return there. */
export function marketingReturnPath(location) {
  const path = typeof window !== "undefined"
    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
    : `${location?.pathname || ""}${location?.search || ""}${location?.hash || ""}`;
  return isAuthPath(path) ? "/" : path;
}

export function goToSignIn(navigate, location) {
  navigate("/app", { state: { from: marketingReturnPath(location) } });
}

export function goToSignUp(navigate, location) {
  navigate("/app?signup=1", { state: { from: marketingReturnPath(location) } });
}

/** Leave auth for the page the user came from (not a random / leftover history entry). */
export function leaveAuth(navigate, location) {
  const from = location?.state?.from;
  if (typeof from === "string" && !isAuthPath(from)) {
    navigate(from);
    return;
  }
  const idx = typeof window !== "undefined" ? window.history.state?.idx : undefined;
  if (typeof idx === "number" && idx > 0) {
    navigate(-1);
    return;
  }
  navigate("/");
}

export function resolveAuthScreen(searchParams, inviteCode = "") {
  if (inviteCode || searchParams.get("join") === "1") return "join";
  if (searchParams.get("signup") === "1") return "signup";
  if (searchParams.get("forgot") === "1") return "forgot";
  return "signin";
}

export function parseAppLocation(pathname, search = "") {
  const params = new URLSearchParams(search);

  const onboardingMatch = pathname.match(/\/app\/onboarding\/(\d+)/);
  if (onboardingMatch) {
    const step = Math.min(1, Math.max(1, parseInt(onboardingMatch[1], 10) || 1));
    return { area: "onboarding", step };
  }

  if (pathname === "/app/subscribe/success") {
    return { area: "subscribeSuccess" };
  }

  const syncMatch = pathname.match(/\/app\/sync\/(\w+)/);
  if (syncMatch && SYNC_VIEWS.includes(syncMatch[1])) {
    return { area: "sync", view: syncMatch[1] };
  }

  if (pathname === "/app/settings") return { area: "overlay", overlay: "settings" };
  if (pathname === "/app/cards") {
    const view = params.get("view");
    const cardsView = view === "library" || view === "unlock" ? view : "draw";
    return { area: "overlay", overlay: "decks", cardsView };
  }
  if (pathname === "/app/paywall") return { area: "overlay", overlay: "paywall" };

  const joinMatch = pathname.match(/\/join\/([a-zA-Z0-9-]+)/);
  if (joinMatch) return { area: "auth", screen: "join", inviteCode: joinMatch[1] };

  if (pathname === "/app" || pathname.startsWith("/app")) {
    return { area: "auth", screen: resolveAuthScreen(params) };
  }

  return { area: "unknown" };
}

export function inviteCodeFromPath(pathname) {
  const match = pathname.match(/\/join\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}
