/**
 * Writes public/sitemap.xml from src/data/blogPosts.js.
 * Run via `npm run sitemap` or automatically before `npm run build`.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { blogPosts } from "../src/data/blogPosts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const ORIGIN = "https://familypause.com";

const urls = [
  { loc: `${ORIGIN}/`, priority: "1.0", changefreq: "weekly" },
  { loc: `${ORIGIN}/blog`, priority: "0.8", changefreq: "weekly" },
  ...blogPosts.map((post) => ({
    loc: `${ORIGIN}/blog/${post.slug}`,
    priority: "0.7",
    changefreq: "monthly",
    lastmod: post.publishDate || undefined,
  })),
];

function entry({ loc, priority, changefreq, lastmod }) {
  const lines = [
    "  <url>",
    `    <loc>${loc}</loc>`,
  ];
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) lines.push(`    <priority>${priority}</priority>`);
  lines.push("  </url>");
  return lines.join("\n");
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(entry).join("\n")}
</urlset>
`;

const out = join(root, "public", "sitemap.xml");
writeFileSync(out, xml, "utf8");
console.log(`Wrote ${out} (${urls.length} URLs)`);
