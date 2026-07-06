export default function BlogComingSoon() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--paper, #FBF6EC)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px",
      textAlign: "center",
    }}>
      <a href="/" style={{ textDecoration: "none", marginBottom: 32 }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600 }}>
          <span style={{ color: "#BE5A37" }}>Family</span>
          <span style={{ color: "#2A251D" }}>Pause</span>
        </span>
      </a>
      <h1 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: "clamp(32px, 5vw, 44px)",
        fontWeight: 600,
        color: "#2A251D",
        marginBottom: 16,
        lineHeight: 1.15,
      }}>
        The FamilyPause blog is <em style={{ color: "#BE5A37" }}>coming soon.</em>
      </h1>
      <p style={{
        fontFamily: "'Lora', serif",
        fontSize: 17,
        color: "#5B5245",
        maxWidth: 420,
        lineHeight: 1.65,
        margin: 0,
      }}>
        Stories on family rhythm, weekly resets, and building a calmer home. Check back soon.
      </p>
      <a
        href="/"
        style={{
          marginTop: 32,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#BE5A37",
          textDecoration: "none",
        }}
      >
        ← Back to home
      </a>
    </div>
  );
}
