/* FamilyPause — sample content for the demo */

window.FP_DATA = {
  family: {
    title: "Spence & Amanda",
    date: "Sunday, June 7, 2026",
    members: [
      { id: "spence", name: "Spence",  role: "spence" },
      { id: "amanda", name: "Amanda",  role: "amanda" },
      { id: "jordan", name: "Jordan",  role: "jordan", kid: true, age: 9 },
      { id: "maya",   name: "Maya",    role: "maya",   kid: true, age: 6 },
    ],
  },

  /* what the agenda looks like before a sync */
  agenda: [
    { id: "t1", cat: "Family",   topic: "Summer rhythm — camps, travel, and Sabbath plan" },
    { id: "t2", cat: "Finance",  topic: "Q2 household budget + the accountant" },
    { id: "t3", cat: "Kids",     topic: "Jordan's checkups, Maya's swim" },
    { id: "t4", cat: "Business", topic: "Launch week — what's blocking us" },
  ],

  /* the raw conversation a user pastes / records */
  transcript:
`Amanda: Okay, before the week runs away from us again — let's actually do this.
Spence: Agreed. Start with money? The accountant emailed about Q2.
Amanda: Yeah, we need to call the accountant before month end, it's getting tight.
Spence: I'll own that. And we still haven't looked at the Q2 household budget together — can we block 30 minutes Tuesday night?
Amanda: Tuesday works. Put it on the shared calendar.
Spence: Done. Kids — Jordan has the dentist, right?
Amanda: Take Jordan to the dentist, Thursday at 3pm. I can do the pickup.
Spence: And Maya's swim lessons start back up. First one is Saturday morning, 9am at the rec center.
Amanda: Got it. I'll handle Maya's swim.
Spence: On the business — launch week. I think we're blocked on the new payment links.
Amanda: Right, you need to replace the placeholder Stripe links in the app before Friday.
Spence: Yep, that's on me. Friday at the latest.
Amanda: One more — let's protect a real Sabbath this week. No screens after dinner Saturday, just us and the kids.
Spence: Love that. Let's make it the default, not the exception.
Amanda: Good sync. That felt like ten minutes.`,

  /* what "Distill" extracts — the review deck */
  extracted: [
    {
      id: "e1", who: "spence", whoLabel: "Spence", cat: "Finance",
      kind: "action", title: "Call the accountant re: Q2 filing",
      quote: "we need to call the accountant before month end",
      due: "Before month end",
    },
    {
      id: "e2", who: "both", whoLabel: "Both", cat: "Finance",
      kind: "appointment", title: "Review Q2 household budget together",
      quote: "can we block 30 minutes Tuesday night?",
      when: "Tue, Jun 9 · 8:00 PM", calendar: true,
    },
    {
      id: "e3", who: "amanda", whoLabel: "Amanda", cat: "Kids",
      kind: "appointment", title: "Take Jordan to the dentist",
      quote: "Thursday at 3pm. I can do the pickup",
      when: "Thu, Jun 11 · 3:00 PM", calendar: true,
    },
    {
      id: "e4", who: "amanda", whoLabel: "Amanda", cat: "Kids",
      kind: "appointment", title: "Maya's swim lessons — first session",
      quote: "Saturday morning, 9am at the rec center",
      when: "Sat, Jun 13 · 9:00 AM", calendar: true,
    },
    {
      id: "e5", who: "spence", whoLabel: "Spence", cat: "Business",
      kind: "action", title: "Replace placeholder Stripe links in the app",
      quote: "before Friday … that's on me",
      due: "Fri, Jun 12",
    },
    {
      id: "e6", who: "both", whoLabel: "Both", cat: "Family",
      kind: "decision", title: "Protect a screen-free Sabbath after dinner Saturday",
      quote: "make it the default, not the exception",
      when: "Every Saturday",
    },
  ],

  assistantIntro: [
    "I read your whole conversation and pulled out everything that needs to happen.",
    "Six items — three appointments, two actions, one decision. Keep what matters, discard the rest.",
  ],
};
