import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/** "loading" | "signedOut" | "signedIn" — no email in marketing chrome. */
export function useAuthSession() {
  const [state, setState] = useState("loading");

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setState(data?.session?.user ? "signedIn" : "signedOut");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setState(session?.user ? "signedIn" : "signedOut");
    });
    return () => {
      alive = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  return state;
}
