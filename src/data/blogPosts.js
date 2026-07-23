/**
 * FamilyPause blog posts.
 *
 * Each post:
 * {
 *   slug: string,
 *   title: string,
 *   excerpt: string,
 *   category: string,
 *   readTime: string,       // e.g. "6 min"
 *   publishDate: string,    // ISO date YYYY-MM-DD
 *   content: string,        // HTML body of the post
 * }
 */
export const blogPosts = [
  {
    slug: "why-busy-families-feel-disconnected",
    title: "Why Busy Families Feel Disconnected (And How One Weekly Family Meeting Can Change Everything)",
    excerpt: "Most families aren't struggling because they don't love each other. They're struggling because life keeps moving faster than their conversations can.",
    category: "Family Planning",
    readTime: "6 min",
    publishDate: "2026-07-22",
    content: `
    <p>By Monday morning, you usually have a rough idea of what the week will look like.</p>
    <p>By Wednesday, plans have changed, schedules have shifted, and something important has slipped through the cracks.</p>
    <p>By Friday, you're both working from different versions of the same week. One person assumed the other knew about soccer practice. Someone forgot to mention the doctor's appointment. Dinner becomes another last-minute decision. Small frustrations pile up until you're both wondering why everything feels harder than it should.</p>
    <p>It isn't because your relationship is broken.</p>
    <p>It isn't because you're bad at communicating.</p>
    <p>More often than not, it's because your family doesn't have a regular time to get on the same page.</p>
    <p>That's why a simple weekly family meeting can make such a surprising difference.</p>
    <h2>The Hidden Cost of a Busy Family Life</h2>
    <p>When life gets busy, conversations naturally become transactional.</p>
    <p>"Who's picking up the kids?" "Did you pay that bill?" "What's for dinner?"</p>
    <p>These conversations keep a household running, but they don't help people feel connected.</p>
    <p>The conversations that strengthen relationships, how you're feeling, what's causing stress, what you're excited about, what you need from each other, rarely happen by accident.</p>
    <p>Without intentionally making space for them, they often don't happen at all.</p>
    <p>Weeks turn into months, and families slowly drift into operating as efficient teammates instead of connected partners.</p>
    <h2>What Is a Weekly Family Meeting?</h2>
    <p>Despite the name, a weekly family meeting isn't a corporate meeting around the kitchen table.</p>
    <p>It isn't therapy. It isn't an opportunity to list everything that's gone wrong during the week.</p>
    <p>A weekly family meeting is simply a dedicated time to pause, reconnect, and build a shared picture of the week ahead.</p>
    <p>For many couples, twenty minutes on a Sunday evening is enough. Sit down with coffee, review what's coming up, talk about what's on your mind, and make sure you're moving through the next week together instead of separately.</p>
    <p>There's no perfect format. The important part is creating a consistent habit of checking in before life gets busy again.</p>
    <h2>How a Weekly Family Meeting Changes Your Week</h2>
    <p>The first change is surprisingly simple. Small frustrations stop becoming big ones. Instead of carrying unspoken concerns for days, you have a predictable time to bring them up while they're still easy to solve.</p>
    <p>The second change is that you begin to feel like a team again. Planning the week together creates something bigger than a schedule. It creates shared ownership. You're no longer making assumptions about who's handling what because you've already talked about it.</p>
    <p>The third change is that everyday life feels calmer. When everyone starts Monday with the same expectations, there's less confusion, fewer forgotten commitments, and far fewer last-minute surprises.</p>
    <p>The goal isn't perfection. The goal is alignment.</p>
    <h2>Why Most Families Stop Having Weekly Meetings</h2>
    <p>Many families try a weekly family meeting once or twice before giving up. Usually, it isn't because the idea doesn't work. It's because the meeting doesn't have enough structure.</p>
    <p>Sometimes the conversation wanders without accomplishing anything. Sometimes logistics completely take over. Schedules. Bills. School. Groceries. By the end, nobody has talked about how they're actually doing.</p>
    <p>Other times, great decisions are made but nobody remembers them a few days later. Without a simple system for capturing plans, even the best conversations can fade into busy schedules.</p>
    <p>That's why successful weekly family meetings are both intentional and practical. They create connection while also helping families stay organized.</p>
    <h2>How to Start a Weekly Family Meeting</h2>
    <p>Getting started doesn't have to be complicated. Choose one consistent day each week. Turn off distractions. Spend twenty minutes talking about:</p>
    <ul>
      <li>What happened this week</li>
      <li>What's coming up next week</li>
      <li>Anything causing stress or concern</li>
      <li>Ways you can support each other</li>
      <li>Family priorities for the days ahead</li>
    </ul>
    <p>That's it. The conversation doesn't need to be perfect. It just needs to happen.</p>
    <p>Over time, those twenty minutes become one of the most valuable habits your family has.</p>
    <h2>One Conversation Can Change More Than You Think</h2>
    <p>You don't need a new productivity system. You don't need a complicated morning routine. You don't need a relationship retreat.</p>
    <p>Sometimes the biggest change begins with one intentional conversation.</p>
    <p>Take twenty minutes this Sunday. Talk about the week ahead. Share what's been sitting on your mind. Listen without rushing to solve every problem. Build a plan together.</p>
    <p>The families who feel the most connected aren't the ones with the least chaos. They're the ones who've learned how to pause in the middle of it.</p>
    <p>One weekly family meeting won't eliminate busy schedules. But it can help your family face them together.</p>
    <h2>Frequently Asked Questions</h2>
    <h3>How long should a weekly family meeting last?</h3>
    <p>Most families find that 20 to 30 minutes is enough. The goal isn't to hold a long meeting, it's to create a consistent habit of reconnecting and planning together.</p>
    <h3>What should we talk about during a weekly family meeting?</h3>
    <p>Discuss upcoming schedules, family commitments, finances, meals, priorities, challenges, and anything that's been left unsaid during the week. Make sure there's also time to check in emotionally, not just logistically.</p>
    <h3>What if my partner doesn't like meetings?</h3>
    <p>Don't focus on the word "meeting." Think of it as a weekly conversation over coffee or after dinner. The habit matters far more than the name.</p>
    <h3>Should children be included?</h3>
    <p>That depends on their age. Many couples begin by creating the habit together before gradually involving children in age-appropriate ways.</p>
    <h2>Start Your Weekly Family Meeting This Week</h2>
    <p>If you've ever finished a busy week wondering where the time went, or why you and your partner felt like you were constantly playing catch-up, you aren't alone.</p>
    <p>One intentional conversation each week can help your family feel more organized, more connected, and more prepared for whatever comes next.</p>
    <p>FamilyPause makes that conversation easier with guided prompts, a shared weekly plan, and calendar integration that keeps everyone on the same page.</p>
    <p><em><a href="https://familypause.com">Start your free 7-day trial</a> and turn one weekly conversation into a calmer, more connected week.</em></p>
  `,
  },
];

/** Newest first */
export function getSortedPosts(posts = blogPosts) {
  return [...posts].sort((a, b) => {
    const da = a.publishDate || "";
    const db = b.publishDate || "";
    return db.localeCompare(da);
  });
}

export function getPostBySlug(slug, posts = blogPosts) {
  return posts.find((p) => p.slug === slug) || null;
}

/** Up to `limit` other posts, newest first, excluding `slug` */
export function getRelatedPosts(slug, limit = 2, posts = blogPosts) {
  return getSortedPosts(posts).filter((p) => p.slug !== slug).slice(0, limit);
}
