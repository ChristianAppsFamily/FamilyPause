import { Link } from "react-router-dom";
import { getSortedPosts } from "../data/blogPosts.js";
import MarketingChrome from "./MarketingChrome.jsx";
import Seo from "./Seo.jsx";

const blogCss = `
.fp-blog {
  max-width: 800px;
  margin: 0 auto;
  padding: 64px 24px 96px;
  font-weight: 400;
}
.fp-blog-eyebrow {
  margin: 0 0 14px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: var(--terra);
}
.fp-blog-title {
  margin: 0 0 16px;
  font-family: var(--display);
  font-size: 32px;
  font-style: italic;
  font-weight: 600;
  line-height: 1.2;
  color: #2E2820;
}
.fp-blog-sub {
  margin: 0 0 48px;
  font-family: var(--serif);
  font-size: 16px;
  line-height: 1.65;
  color: #6A5A40;
  max-width: 560px;
}
.fp-blog-list {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.fp-blog-card {
  display: block;
  background: #F0EAE0;
  border-radius: 12px;
  padding: 36px 40px;
  min-height: 180px;
  border: none;
  text-decoration: none;
  color: #2E2820;
  transition: transform .18s ease, box-shadow .18s ease;
  overflow: hidden;
}
.fp-blog-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(46, 40, 32, .08);
  color: #2E2820;
}
.fp-blog-card-thumb {
  float: right;
  width: 120px;
  height: 90px;
  margin: 0 0 0 16px;
  border-radius: 8px;
  object-fit: cover;
  object-position: center;
  flex-shrink: 0;
}
.fp-blog-pill {
  display: inline-block;
  margin: 0 0 14px;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: var(--mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: .12em;
  text-transform: uppercase;
  background: var(--terra-soft, #F1DDCF);
  color: var(--terra-d, #A2481F);
}
.fp-blog-card-title {
  margin: 0 0 12px;
  font-family: var(--display);
  font-size: 22px;
  font-style: normal;
  font-weight: 500;
  line-height: 1.3;
  color: #2E2820;
}
.fp-blog-card:hover .fp-blog-card-title {
  color: #2E2820;
}
.fp-blog-card-excerpt {
  margin: 0 0 20px;
  font-family: var(--serif);
  font-size: 14px;
  line-height: 1.6;
  color: #6A5A40;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.fp-blog-card-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  clear: both;
}
.fp-blog-readtime {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .04em;
  color: #A09070;
}
.fp-blog-read {
  font-family: var(--serif);
  font-size: 13px;
  color: #B85C38;
  flex-shrink: 0;
}
.fp-blog-read span { margin-left: 4px; }
@media (max-width: 560px) {
  .fp-blog { padding: 48px 20px 72px; }
  .fp-blog-title { font-size: 26px; }
  .fp-blog-card { padding: 28px 24px; min-height: 0; }
  .fp-blog-card-thumb { display: none; }
  .fp-blog-card-title { font-size: 20px; }
}
`;

export function BlogPostCard({ post }) {
  return (
    <Link className="fp-blog-card" to={`/blog/${post.slug}`}>
      {post.image ? (
        <img
          className="fp-blog-card-thumb"
          src={post.image}
          alt={post.imageAlt || ""}
          loading="lazy"
          decoding="async"
          style={post.imagePosition ? { objectPosition: post.imagePosition } : undefined}
        />
      ) : null}
      {post.category ? <span className="fp-blog-pill">{post.category}</span> : null}
      <h2 className="fp-blog-card-title">{post.title}</h2>
      {post.excerpt ? <p className="fp-blog-card-excerpt">{post.excerpt}</p> : null}
      <div className="fp-blog-card-meta">
        <span className="fp-blog-readtime">{post.readTime}</span>
        <span className="fp-blog-read">Read <span aria-hidden="true">→</span></span>
      </div>
    </Link>
  );
}

export default function BlogIndex() {
  const posts = getSortedPosts();

  return (
    <MarketingChrome>
      <Seo
        title="FamilyPause Blog — Family Planning, Marriage, and Weekly Conversations"
        description="Practical ideas for families who want to be more intentional. Weekly family meetings, marriage communication, and the conversations that keep everything together."
        canonical="https://familypause.com/blog"
        ogTitle="FamilyPause Blog — Family Planning, Marriage, and Weekly Conversations"
        ogDescription="Practical ideas for families who want to be more intentional. Weekly family meetings, marriage communication, and the conversations that keep everything together."
        ogUrl="https://familypause.com/blog"
      />
      <style>{blogCss}</style>
      <main className="fp-blog">
        <p className="fp-blog-eyebrow">The FamilyPause Blog</p>
        <h1 className="fp-blog-title">Ideas for families who want to be more intentional.</h1>
        <p className="fp-blog-sub">
          Practical thinking on family planning, marriage, and the weekly conversations that keep everything together.
        </p>
        <div className="fp-blog-list">
          {posts.map((post) => (
            <BlogPostCard key={post.slug} post={post} />
          ))}
        </div>
      </main>
    </MarketingChrome>
  );
}
