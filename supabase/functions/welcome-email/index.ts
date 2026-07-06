// Welcome email + optional Resend audience drip enrollment for new trial users.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function welcomeHtml(firstName: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:Georgia,'Lora',serif;color:#2A251D;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <p style="font-size:14px;letter-spacing:0.12em;text-transform:uppercase;color:#BE5A37;margin:0 0 24px;">FamilyPause</p>
    <h1 style="font-size:28px;font-weight:600;line-height:1.25;margin:0 0 20px;">Hi ${firstName},</h1>
    <p style="font-size:17px;line-height:1.65;color:#5B5245;margin:0 0 16px;">
      You just started something good. Your 7-day trial is live, and your family workspace is ready whenever you are.
    </p>
    <p style="font-size:17px;line-height:1.65;color:#5B5245;margin:0 0 16px;">
      This Sunday (or whenever works), sit down together, talk like humans, and let FamilyPause handle the structure.
    </p>
    <p style="font-size:17px;line-height:1.65;color:#5B5245;margin:0 0 32px;">
      <a href="https://familypause.com/app" style="color:#BE5A37;">Open FamilyPause →</a>
    </p>
    <p style="font-size:16px;line-height:1.6;color:#5B5245;margin:0;">
      Glad you're here,<br><strong>Spence</strong><br>Founder, FamilyPause
    </p>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { email, firstName = "Friend", enrollDrip = false } = await req.json();
    if (!email || typeof email !== "string") return json({ error: "Missing email" }, 400);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "RESEND_API_KEY not configured" }, 500);

    const from = Deno.env.get("WELCOME_FROM_EMAIL") || "FamilyPause <hello@familypause.com>";

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "You just started something good.",
        html: welcomeHtml(String(firstName).replace(/[<>]/g, "")),
      }),
    });

    const sendData = await sendRes.json();
    if (!sendRes.ok) {
      return json({ error: sendData?.message || "Resend send failed" }, 502);
    }

    if (enrollDrip) {
      const audienceId = Deno.env.get("RESEND_AUDIENCE_TRIAL");
      if (audienceId) {
        await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            first_name: firstName,
            unsubscribed: false,
            tags: [{ name: "trial-7day", value: "true" }],
          }),
        });
      }
    }

    return json({ ok: true, id: sendData?.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
