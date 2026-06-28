/** URL helpers — keep browser back/forward aligned with in-app screens */

export const SYNC_VIEWS = ["agenda", "capture", "processing", "review", "plan"];

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

export function calendarSyncPath() {
  return "/app/calendar-sync";
}

export function authPathForScreen(screen, inviteCode = "") {
  switch (screen) {
    case "signup":
      return "/app?signup=1";
    case "forgot":
      return "/app?forgot=1";
    case "join":
      return inviteCode ? `/join/${inviteCode}` : "/app?join=1";
    case "signin":
    default:
      return "/app";
  }
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
    const step = Math.min(5, Math.max(1, parseInt(onboardingMatch[1], 10) || 1));
    return { area: "onboarding", step };
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
  if (pathname === "/app/calendar-sync") return { area: "overlay", overlay: "calendar-sync" };

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
