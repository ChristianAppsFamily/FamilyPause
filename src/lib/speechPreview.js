/** Browser live caption preview (Chrome/Safari). Not available on Brave desktop. */
export function speechPreviewSupported() {
  return !!(typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition));
}

export function startSpeechPreview({ onInterim, onError }) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  let finals = "";

  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const chunk = event.results[i][0]?.transcript || "";
      if (event.results[i].isFinal) finals += `${chunk} `;
      else interim += chunk;
    }
    onInterim(`${finals}${interim}`.trim());
  };

  rec.onerror = (event) => {
    if (event.error === "aborted" || event.error === "no-speech") return;
    onError?.(event.error);
  };

  try {
    rec.start();
  } catch {
    return null;
  }

  return {
    stop() {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.stop();
      } catch {
        /* ignore */
      }
    },
  };
}
