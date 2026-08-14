import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getPostBySlug, getRelatedPosts } from "../data/blogPosts.js";
import { supabase } from "../lib/supabase";
import MarketingChrome from "./MarketingChrome.jsx";
import Seo from "./Seo.jsx";
import { BlogPostCard } from "./BlogIndex.jsx";

const postCss = `
.fp-post {
  max-width: 680px;
  margin: 0 auto;
  padding: 64px 24px 96px;
  font-weight: 400;
}
.fp-post-pill {
  display: inline-block;
  margin: 0 0 16px;
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
.fp-post-title {
  margin: 0 0 18px;
  font-family: var(--display);
  font-size: 38px;
  font-style: italic;
  font-weight: 600;
  line-height: 1.2;
  color: #2E2820;
}
.fp-post-byline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 22px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: .04em;
  color: var(--ink-3);
}
.fp-post-byline .dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--ink-3);
  opacity: .7;
}
.fp-post-rule {
  height: 1px;
  border: none;
  margin: 0 0 36px;
  background: var(--terra);
  opacity: .55;
}
.fp-post-hero {
  display: block;
  width: 100%;
  max-width: 680px;
  height: 340px;
  margin: 0 0 40px;
  border: none;
  border-radius: 12px;
  object-fit: cover;
  object-position: center;
  box-shadow: 0 4px 24px rgba(46, 40, 32, 0.10);
  opacity: 0;
  animation: fp-post-hero-fade 0.4s ease forwards;
}
@keyframes fp-post-hero-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
.fp-post-body {
  font-family: var(--serif);
  font-size: 17px;
  line-height: 1.75;
  color: #2E2820;
}
.fp-post-body p { margin: 0 0 24px; }
.fp-post-body p:last-child { margin-bottom: 0; }
.fp-post-body ul {
  margin: 0 0 24px;
  padding-left: 1.25em;
}
.fp-post-body li {
  margin: 0 0 8px;
  line-height: 1.65;
}
.fp-post-body li:last-child { margin-bottom: 0; }
.fp-post-body h2 {
  margin: 40px 0 16px;
  font-family: var(--display);
  font-size: 26px;
  font-style: italic;
  font-weight: 600;
  line-height: 1.25;
  color: #2E2820;
}
.fp-post-body h3 {
  margin: 32px 0 12px;
  font-family: var(--display);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
  color: #2E2820;
}
.fp-post-body strong, .fp-post-body b {
  font-family: var(--serif);
  font-weight: 700;
  color: #2E2820;
}
.fp-post-body a {
  color: #B85C38;
  text-decoration: none;
}
.fp-post-body a:hover { text-decoration: underline; }
.fp-post-body blockquote {
  margin: 28px 0;
  padding: 16px 20px;
  background: #F5D8CC;
  border-left: 3px solid var(--terra);
  border-radius: 0 8px 8px 0;
  font-family: var(--display);
  font-size: 18px;
  font-style: italic;
  line-height: 1.45;
  color: #6A5A40;
}
.fp-post-body blockquote p { margin: 0; }
.fp-guide-inline {
  margin: 32px 0;
  padding: 24px;
  background: #F0EAE0;
  border-radius: 12px;
}
.fp-guide-inline-eyebrow {
  margin: 0 0 8px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--terra);
}
.fp-guide-inline-title {
  margin: 0 0 8px;
  font-family: var(--display);
  font-size: 20px;
  font-style: italic;
  font-weight: 600;
  color: #2E2820;
}
.fp-guide-inline-sub {
  margin: 0 0 16px;
  font-family: var(--serif);
  font-size: 13px;
  line-height: 1.5;
  color: #6A5A40;
}
.fp-guide-inline-form {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.fp-guide-inline-input {
  flex: 1 1 180px;
  min-width: 0;
  background: #FAF7F2;
  border: 1px solid #D8CFC0;
  border-radius: 8px;
  color: var(--ink);
  padding: 12px 14px;
  font: 15px var(--serif);
  outline: none;
}
.fp-guide-inline-input:focus {
  border-color: var(--terra);
  box-shadow: 0 0 0 3px var(--terra-tint);
}
.fp-guide-inline-btn {
  flex: 0 0 auto;
  border: none;
  border-radius: 8px;
  background: var(--terra);
  color: #fff;
  font-family: var(--serif);
  font-size: 15px;
  font-weight: 500;
  padding: 12px 18px;
  cursor: pointer;
}
.fp-guide-inline-btn:hover:not(:disabled) { background: var(--terra-d); }
.fp-guide-inline-btn:disabled { opacity: .65; cursor: not-allowed; }
.fp-guide-inline-error {
  margin: 10px 0 0;
  font: 13px/1.4 var(--serif);
  color: var(--red);
}
.fp-guide-inline-success {
  display: flex;
  align-items: center;
  gap: 12px;
}
.fp-guide-inline-check {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--olive-tint);
  color: var(--olive);
  display: grid;
  place-items: center;
  font-weight: 600;
  flex-shrink: 0;
}
.fp-guide-inline-success p {
  margin: 0;
  font-family: var(--display);
  font-size: 16px;
  font-style: italic;
  color: #2E2820;
}
.fp-post-footer {
  margin-top: 56px;
  padding-top: 36px;
  border-top: 1px solid var(--line);
}
.fp-post-more-label {
  margin: 0 0 18px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.fp-post-more-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 28px;
}
.fp-post-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 52px;
  border: none;
  border-radius: 8px;
  background: var(--terra);
  color: #fff;
  font-family: var(--serif);
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(190, 90, 55, .24);
}
.fp-post-cta:hover { background: var(--terra-d); }
.fp-post-404 {
  text-align: center;
  padding: 80px 24px 100px;
}
.fp-post-404 h1 {
  margin: 0 0 20px;
  font-family: var(--display);
  font-size: 28px;
  font-style: italic;
  font-weight: 600;
  color: #2E2820;
}
.fp-post-404 a {
  font-family: var(--serif);
  font-size: 15px;
  color: var(--terra);
  text-decoration: none;
}
.fp-post-404 a:hover { text-decoration: underline; }

/* Reuse index card styles on related posts */
.fp-blog-card {
  display: block;
  background: #F0EAE0;
  border-radius: 12px;
  padding: 36px 40px;
  min-height: 180px;
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

@media (max-width: 560px) {
  .fp-post { padding: 48px 20px 72px; }
  .fp-post-title { font-size: 30px; }
  .fp-post-hero { height: 220px; }
  .fp-guide-inline-form { flex-direction: column; }
  .fp-guide-inline-btn { width: 100%; }
}
`;

function formatPublishDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function truncateMeta(text, max = 155) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Insert the guide capture after the third </p> in HTML content. */
export function splitContentAroundGuide(html) {
  const source = String(html || "");
  if (!source.trim()) return { before: "", after: "" };

  const re = /<\/p>/gi;
  let match;
  let count = 0;
  let insertAt = -1;
  while ((match = re.exec(source)) !== null) {
    count += 1;
    if (count === 3) {
      insertAt = match.index + match[0].length;
      break;
    }
  }

  if (insertAt === -1) {
    return { before: source, after: "" };
  }
  return {
    before: source.slice(0, insertAt),
    after: source.slice(insertAt),
  };
}

function PostHeroImage({ src, alt, objectPosition }) {
  const [hidden, setHidden] = useState(false);
  if (!src || hidden) return null;

  return (
    <img
      className="fp-post-hero"
      src={src}
      alt={alt}
      loading="eager"
      decoding="async"
      style={objectPosition ? { objectPosition } : undefined}
      onError={() => setHidden(true)}
    />
  );
}

function GuideCaptureBlock() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setStatus("loading");
    const { error: invokeError } = await supabase.functions.invoke("capture-lead", {
      body: { email: trimmed, kind: "guide" },
    });

    if (invokeError) {
      setStatus("idle");
      setError("We couldn't send the guide. Please try again.");
      return;
    }

    setStatus("success");
  };

  if (status === "success") {
    return (
      <div className="fp-guide-inline" role="status">
        <div className="fp-guide-inline-success">
          <div className="fp-guide-inline-check" aria-hidden="true">✓</div>
          <p>Check your inbox. It&apos;s on the way.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fp-guide-inline">
      <p className="fp-guide-inline-eyebrow">Free Planning Guide</p>
      <h2 className="fp-guide-inline-title">Get the One-Plan Guide</h2>
      <p className="fp-guide-inline-sub">Five conversations to have with your family this week.</p>
      <form className="fp-guide-inline-form" onSubmit={submit} noValidate>
        <input
          className="fp-guide-inline-input"
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          disabled={status === "loading"}
          aria-label="Email"
        />
        <button
          type="submit"
          className="fp-guide-inline-btn"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Sending..." : "Send Me the Guide"}
        </button>
      </form>
      {error ? <p className="fp-guide-inline-error" role="alert">{error}</p> : null}
    </div>
  );
}

function PostNotFound() {
  return (
    <MarketingChrome>
      <Seo
        title="Post not found — FamilyPause"
        description="This FamilyPause blog post could not be found."
        canonical="https://familypause.com/blog"
      />
      <style>{postCss}</style>
      <main className="fp-post-404">
        <h1>Post not found.</h1>
        <Link to="/blog">← Back to the blog</Link>
      </main>
    </MarketingChrome>
  );
}

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const post = getPostBySlug(slug);
  const related = useMemo(() => (post ? getRelatedPosts(post.slug, 2) : []), [post]);
  const { before, after } = useMemo(
    () => splitContentAroundGuide(post?.content || ""),
    [post],
  );

  if (!post) return <PostNotFound />;

  const canonical = `https://familypause.com/blog/${post.slug}`;
  const metaDescription = truncateMeta(post.excerpt);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || "",
    author: {
      "@type": "Organization",
      name: "FamilyPause Team",
    },
    publisher: {
      "@type": "Organization",
      name: "FamilyPause",
      url: "https://familypause.com",
    },
    datePublished: post.publishDate,
    url: canonical,
  };

  return (
    <MarketingChrome>
      <Seo
        title={`${post.title} — FamilyPause`}
        description={metaDescription}
        canonical={canonical}
        ogTitle={post.title}
        ogDescription={post.excerpt || metaDescription}
        ogUrl={canonical}
        ogType="article"
        jsonLd={jsonLd}
      />
      <style>{postCss}</style>
      <article className="fp-post">
        {post.category ? <span className="fp-post-pill">{post.category}</span> : null}
        <h1 className="fp-post-title">{post.title}</h1>
        <div className="fp-post-byline">
          <span>By the FamilyPause Team</span>
          <span className="dot" aria-hidden="true" />
          <span>{formatPublishDate(post.publishDate)}</span>
          <span className="dot" aria-hidden="true" />
          <span>{post.readTime}</span>
        </div>
        <hr className="fp-post-rule" />

        <PostHeroImage
          src={post.image}
          alt={post.imageAlt || ""}
          objectPosition={post.imagePosition}
        />

        <div className="fp-post-body">
          {before ? (
            <div dangerouslySetInnerHTML={{ __html: before }} />
          ) : null}
          {before ? <GuideCaptureBlock /> : null}
          {after ? (
            <div dangerouslySetInnerHTML={{ __html: after }} />
          ) : null}
        </div>

        <footer className="fp-post-footer">
          {related.length > 0 ? (
            <>
              <p className="fp-post-more-label">More from FamilyPause</p>
              <div className="fp-post-more-list">
                {related.map((p) => (
                  <BlogPostCard key={p.slug} post={p} />
                ))}
              </div>
            </>
          ) : null}
          <button
            type="button"
            className="fp-post-cta"
            onClick={() => navigate("/app?signup=1", { replace: true })}
          >
            Create Your Family Plan Free
          </button>
        </footer>
      </article>
    </MarketingChrome>
  );
}
