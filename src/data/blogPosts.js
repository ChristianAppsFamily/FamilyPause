/**
 * FamilyPause blog posts.
 * Add posts here later — keep the array empty until content is ready.
 *
 * Each post:
 * {
 *   slug: string,
 *   title: string,
 *   excerpt: string,
 *   category: string,
 *   readTime: string,       // e.g. "6 min read"
 *   publishDate: string,    // ISO date YYYY-MM-DD
 *   content: string,        // HTML body of the post
 * }
 */
export const blogPosts = [];

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
