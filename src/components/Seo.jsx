import { Helmet } from "react-helmet-async";

/**
 * Sets document head tags for marketing / blog pages.
 */
export default function Seo({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogUrl,
  ogType = "website",
  jsonLd,
}) {
  const resolvedOgTitle = ogTitle || title;
  const resolvedOgDescription = ogDescription || description;
  const resolvedOgUrl = ogUrl || canonical;

  return (
    <Helmet>
      {title ? <title>{title}</title> : null}
      {description ? <meta name="description" content={description} /> : null}
      {canonical ? <link rel="canonical" href={canonical} /> : null}
      {resolvedOgTitle ? <meta property="og:title" content={resolvedOgTitle} /> : null}
      {resolvedOgDescription ? (
        <meta property="og:description" content={resolvedOgDescription} />
      ) : null}
      {resolvedOgUrl ? <meta property="og:url" content={resolvedOgUrl} /> : null}
      <meta property="og:type" content={ogType} />
      {jsonLd ? (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      ) : null}
    </Helmet>
  );
}
