/** Supabase may return a user with empty identities when email already exists (confirm off). */
export function isExistingAccountSignup(signUpData) {
  const user = signUpData?.user;
  if (!user) return false;
  if (!signUpData?.session) {
    const identities = user.identities;
    if (Array.isArray(identities) && identities.length === 0) return true;
  }
  const created = user.created_at ? new Date(user.created_at).getTime() : 0;
  const now = Date.now();
  if (created && now - created > 60_000) return true;
  return false;
}
