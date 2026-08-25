import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/** Pathname only — never query strings (emails, session ids) or form/conversation data. */
function pageViewParams(pathname, title) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return {
    page_location: origin + pathname,
    page_path: pathname,
    page_title: title,
  };
}

/**
 * Sends a GA4 page_view on client-side route changes.
 * The first view is already sent from index.html so this skips the initial mount.
 */
export function AnalyticsRouteListener() {
  const location = useLocation();
  const previousPath = useRef(null);

  useEffect(() => {
    if (typeof window.gtag !== "function") return;
    if (previousPath.current === location.pathname) return;
    const isFirst = previousPath.current === null;
    previousPath.current = location.pathname;
    if (isFirst) return;
    window.gtag("event", "page_view", pageViewParams(location.pathname, document.title));
  }, [location.pathname]);

  return null;
}
