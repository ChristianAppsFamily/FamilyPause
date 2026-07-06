import { supabase } from "./supabase";

/** Fire-and-forget welcome email via edge function. Never blocks signup. */
export async function triggerWelcomeEmail({ email, firstName, enrollDrip = false }) {
  if (!email) return;
  try {
    await supabase.functions.invoke("welcome-email", {
      body: { email, firstName: firstName || "Friend", enrollDrip },
    });
  } catch (e) {
    console.warn("[welcome-email] invoke failed", e);
  }
}
