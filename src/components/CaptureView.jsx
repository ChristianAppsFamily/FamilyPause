import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canRecordAudio, pickRecordingMimeType, transcribeAudioBlob } from "../lib/transcribe";
import { speechPreviewSupported, startSpeechPreview } from "../lib/speechPreview";
import {
  CAPTURE_QUESTIONS,
  CAPTURE_STARTERS,
  CAPTURE_TOPIC_LIST,
  CAPTURE_TYPE_META,
  analyzeCaptureText,
  countWords,
  formatCaptureDuration,
  formatCaptureTimer,
  highlightPhrases,
} from "../lib/captureHeuristics";

const TRANSCRIPT_MAX_CHARS = 50000;
const WAVE_BARS = 96;

function Ico({ d, size = 16, fill = false, sw = 1.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const IC = {
  mic: ["M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z", "M5 11a7 7 0 0 0 14 0", "M12 18v3"],
  type: ["M4 7V4h16v3", "M9 20h6", "M12 4v16"],
  clipboard: ["M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2", "M9 4h6v3H9z"],
  check: "M5 12.5 10 17.5 19.5 6.5",
  pause: ["M6 5h4v14H6z", "M14 5h4v14h-4z"],
  play: "M8 5v14l11-7z",
  square: "M6 6h12v12H6z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  chevL: "M15 6l-6 6 6 6",
  plus: "M12 5v14M5 12h14",
  shuffle: ["M16 3h5v5", "M4 20l16-16", "M21 16v5h-5", "M15 15l6 6", "M4 4l5 5"],
  heart: "M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.4l8.8-8.7a5 5 0 0 0 0-7.1z",
  cal: ["M7 3v3M17 3v3", "M4 8h16", "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"],
  todo: ["M9 11l3 3L22 4", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],
  scale: ["M12 3v18", "M5 7h14", "M5 7l-2 6h6L5 7z", "M19 7l-2 6h6l-4-6z"],
  note: ["M9 3h7l4 4v14H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z", "M16 3v5h5"],
  trash: ["M3 6h18", "M8 6V4h8v2", "M19 6l-1 14H6L5 6"],
  refresh: ["M21 12a9 9 0 0 0-15-6.7L3 8", "M3 3v5h5", "M3 12a9 9 0 0 0 15 6.7L21 16", "M21 21v-5h-5"],
  mail: ["M4 6h16v12H4z", "M4 7l8 6 8-6"],
};

function typeIcon(key) {
  switch (key) {
    case "appt": return IC.cal;
    case "todo": return IC.todo;
    case "dec": return IC.scale;
    case "note": return IC.note;
    case "tt": return IC.heart;
    default: return IC.note;
  }
}

function whoColor(i) {
  return i === 0 ? "var(--blue)" : i === 1 ? "var(--coral)" : "var(--violet)";
}

function HighlightedText({ text, live }) {
  const segs = useMemo(() => highlightPhrases(text), [text]);
  return (
    <p className="cp-said">
      {segs.map((s, i) => (
        s.type
          ? <mark key={i} className={`cp-hl on hl-${s.type}`}>{s.text}</mark>
          : <span key={i}>{s.text}</span>
      ))}
      {live ? <span className="cp-caret" /> : null}
    </p>
  );
}

function Legend() {
  return (
    <div className="cp-legend">
      {["appt", "todo", "dec", "tt"].map((k) => (
        <span key={k}>
          <i style={{ background: CAPTURE_TYPE_META[k].color }} />
          {CAPTURE_TYPE_META[k].one}
        </span>
      ))}
    </div>
  );
}

function Waveform({ levels, active }) {
  return (
    <div className="cp-wave" style={{ height: 72 }} aria-hidden="true">
      {levels.map((h, i) => (
        <i
          key={i}
          style={{
            height: Math.max(4, h * 72),
            background: active ? "var(--em)" : "#CBD5E1",
            opacity: 0.35 + 0.65 * (i / levels.length),
          }}
        />
      ))}
    </div>
  );
}

/**
 * Desktop Capture — Talk / Type / Paste.
 */
export default function CaptureView({
  text,
  setText,
  mode,
  setMode,
  onBack,
  onProcess,
  adults = [],
  agendaTopics = [],
  setAgendaTopics,
}) {
  const [uiMode, setUiMode] = useState(() => (mode === "dictate" ? "talk" : "type"));
  const [phase, setPhase] = useState("idle"); // idle | rec | paused | trans | ready
  const [secs, setSecs] = useState(0);
  const [livePreview, setLivePreview] = useState("");
  const [dictNotice, setDictNotice] = useState("");
  const [dictStatus, setDictStatus] = useState("");
  const [wave, setWave] = useState(() => Array.from({ length: WAVE_BARS }, () => 0.08));
  const [qi, setQi] = useState(0);
  const [pastePresent, setPastePresent] = useState(() => mode === "paste" && !!(text || "").trim());

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeRef = useRef("");
  const baseRef = useRef("");
  const previewRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const meterRafRef = useRef(null);
  const timerRef = useRef(null);
  const typeRef = useRef(null);

  const stopMeter = () => {
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  };

  const stopPreview = () => {
    previewRef.current?.stop();
    previewRef.current = null;
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const stopRecorder = () => new Promise((resolve) => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") {
      releaseStream();
      recorderRef.current = null;
      resolve(null);
      return;
    }
    rec.onstop = () => {
      setTimeout(() => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: mimeRef.current || "audio/webm" })
          : null;
        chunksRef.current = [];
        releaseStream();
        recorderRef.current = null;
        resolve(blob);
      }, 320);
    };
    if (rec.state === "recording") {
      try { rec.requestData(); } catch { /* ignore */ }
    }
    try { rec.stop(); } catch { resolve(null); }
  });

  const cancelRecording = () => {
    if (phase === "trans") return;
    stopPreview();
    stopMeter();
    clearTimer();
    setLivePreview("");
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = () => {
        chunksRef.current = [];
        releaseStream();
        recorderRef.current = null;
      };
      try { rec.stop(); } catch { /* ignore */ }
    } else {
      releaseStream();
      recorderRef.current = null;
      chunksRef.current = [];
    }
    setPhase(text.trim() ? "ready" : "idle");
    setDictStatus("");
    setWave(Array.from({ length: WAVE_BARS }, () => 0.08));
  };

  const confirmRecording = async () => {
    if (phase === "trans") return text;
    const previewFallback = livePreview.trim();
    setPhase("trans");
    setDictStatus("Transcribing…");
    setLivePreview("");
    clearTimer();
    try {
      stopPreview();
      const blob = await stopRecorder();
      stopMeter();
      if (!blob || blob.size < 200) {
        setDictNotice("Recording too short. Speak for at least 2–3 seconds, then stop.");
        setPhase(baseRef.current.trim() ? "ready" : "idle");
        setText(baseRef.current);
        return baseRef.current;
      }
      const spoken = await transcribeAudioBlob(blob, mimeRef.current, {
        previewFallback,
        onStatus: setDictStatus,
      });
      if (!spoken) {
        setDictNotice("Couldn't pick up any speech. Check your mic and try again.");
        setPhase(baseRef.current.trim() ? "ready" : "idle");
        setText(baseRef.current);
        return baseRef.current;
      }
      const merged = baseRef.current
        ? `${baseRef.current.trim()} ${spoken}`.trim()
        : spoken;
      setText(merged);
      setMode("dictate");
      setDictNotice("");
      setPhase("ready");
      return merged;
    } catch (err) {
      setDictNotice(err.message || "Transcription failed. Try again, or type or paste instead.");
      setPhase(baseRef.current.trim() ? "ready" : "idle");
      setText(baseRef.current);
      return baseRef.current;
    } finally {
      setDictStatus("");
      setWave(Array.from({ length: WAVE_BARS }, () => 0.08));
    }
  };

  const startRecording = async () => {
    setDictNotice("");
    setLivePreview("");
    setUiMode("talk");
    if (!canRecordAudio()) {
      setDictNotice("Recording isn't supported in this browser. Type or paste instead.");
      return;
    }
    try {
      const mime = pickRecordingMimeType();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      mimeRef.current = mime;
      chunksRef.current = [];
      baseRef.current = text.trim();
      setSecs(0);

      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tickMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const step = Math.max(1, Math.floor(data.length / WAVE_BARS));
        const next = [];
        for (let i = 0; i < WAVE_BARS; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
          next.push(Math.min(1, (sum / step) / 180));
        }
        setWave(next);
        meterRafRef.current = requestAnimationFrame(tickMeter);
      };
      meterRafRef.current = requestAnimationFrame(tickMeter);

      if (speechPreviewSupported()) {
        previewRef.current = startSpeechPreview({
          onInterim: (spoken) => setLivePreview(spoken),
          onError: () => {},
        });
      }

      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorderRef.current = rec;
      rec.start();
      setPhase("rec");
      setMode("dictate");
      clearTimer();
      timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
    } catch {
      stopPreview();
      stopMeter();
      releaseStream();
      setDictNotice("Microphone access denied. Allow the mic in your browser settings and try again.");
      setPhase("idle");
    }
  };

  const pauseRecording = () => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;
    try { rec.pause(); } catch { return; }
    stopPreview();
    clearTimer();
    setPhase("paused");
  };

  const resumeRecording = () => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "paused") return;
    try { rec.resume(); } catch { return; }
    if (speechPreviewSupported()) {
      previewRef.current = startSpeechPreview({
        onInterim: (spoken) => setLivePreview(spoken),
        onError: () => {},
      });
    }
    clearTimer();
    timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
    setPhase("rec");
  };

  useEffect(() => () => {
    stopPreview();
    stopMeter();
    clearTimer();
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try { rec.stop(); } catch { /* ignore */ }
    }
    releaseStream();
  }, []);

  // If parent restores a draft with text, show ready/type appropriately
  useEffect(() => {
    if (phase !== "idle") return;
    if (mode === "dictate" && text.trim()) setPhase("ready");
    if (mode === "paste" && text.trim()) {
      setUiMode("type");
      setPastePresent(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- hydrate once

  const busy = phase === "rec" || phase === "paused" || phase === "trans";
  const displayTalkText = busy
    ? `${baseRef.current}${baseRef.current && livePreview ? " " : ""}${livePreview}`
    : text;
  const analysisSource = uiMode === "talk" ? displayTalkText : text;
  const { counts, topics: heardTopics } = useMemo(
    () => analyzeCaptureText(analysisSource),
    [analysisSource],
  );
  const typedWords = countWords(uiMode === "type" ? text : "");
  const talkWords = countWords(text);
  const overLimit = (text || "").length > TRANSCRIPT_MAX_CHARS;

  const canBuild = !busy && !overLimit && (
    (uiMode === "talk" && phase === "ready" && text.trim().length > 0)
    || (uiMode === "type" && typedWords >= 6)
    || (uiMode === "paste" && pastePresent && text.trim().length > 0)
  );

  const coveredTopics = useMemo(() => {
    const set = new Set([
      ...(agendaTopics || []),
      ...heardTopics,
    ]);
    return set;
  }, [agendaTopics, heardTopics]);

  const switchMode = (next) => {
    if (busy) return;
    setUiMode(next);
    if (next === "talk") {
      setMode("dictate");
      setPhase(text.trim() ? "ready" : "idle");
    } else if (next === "type") {
      setMode("paste");
      setPastePresent(false);
    } else {
      setMode("paste");
      if (text.trim()) setPastePresent(true);
    }
  };

  const toggleTopic = (key) => {
    if (!setAgendaTopics) return;
    setAgendaTopics((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.includes(key) ? list.filter((t) => t !== key) : [...list, key];
    });
  };

  const insertStarter = (s) => {
    const next = text + (text && !text.endsWith("\n") ? "\n" : "") + s.replace(/\.\.\.$/, " ");
    setText(next);
    setMode("paste");
    setTimeout(() => {
      const el = typeRef.current;
      if (el) {
        el.focus();
        el.selectionStart = el.selectionEnd = el.value.length;
      }
    }, 0);
  };

  const applyPaste = useCallback((raw) => {
    const t = String(raw || "").trim();
    if (!t) return;
    setText(t.slice(0, TRANSCRIPT_MAX_CHARS));
    setPastePresent(true);
    setMode("paste");
    setUiMode("paste");
  }, [setText, setMode]);

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      applyPaste(t);
    } catch {
      setDictNotice("Couldn't read the clipboard. Press ⌘V / Ctrl+V in the drop zone instead.");
    }
  };

  const handleBuild = async () => {
    let payload = text;
    let nextMode = uiMode === "talk" ? "dictate" : "paste";
    if (phase === "rec" || phase === "paused") {
      payload = await confirmRecording();
      nextMode = "dictate";
    }
    if ((payload || "").length > TRANSCRIPT_MAX_CHARS) return;
    if ((payload || "").trim().length > 0) onProcess(payload, nextMode);
  };

  const q = CAPTURE_QUESTIONS[qi % CAPTURE_QUESTIONS.length];
  const personA = adults[0] || "You";
  const personB = adults[1] || null;

  return (
    <div className="view capture-view">
      <div className="cp-body">
        <div className="cp-left">
          <div>
            <h1 className="cp-h1">Talk through your week</h1>
            <p className="cp-sub">Speak together, type, or paste. It doesn&apos;t need to be organized.</p>
          </div>

          <div className="cp-seg" role="tablist">
            {[
              ["talk", IC.mic, "Talk together"],
              ["type", IC.type, "Type"],
              ["paste", IC.clipboard, "Paste"],
            ].map(([k, icon, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={uiMode === k}
                className={uiMode === k ? "on" : ""}
                disabled={busy && k !== "talk"}
                onClick={() => switchMode(k)}
              >
                <Ico d={icon} size={18} />{label}
              </button>
            ))}
          </div>

          {dictNotice && !busy && (
            <p className="dictnotice dictnotice-warn">{dictNotice}</p>
          )}
          {overLimit && (
            <p className="dictnotice dictnotice-warn">
              That&apos;s too long ({text.length.toLocaleString()} characters).
              Trim to {TRANSCRIPT_MAX_CHARS.toLocaleString()} or fewer.
            </p>
          )}

          <div className="cp-card">
            {uiMode === "talk" && phase === "idle" && (
              <div className="cp-idle">
                <button type="button" className="cp-recbtn" style={{ width: 120, height: 120 }} onClick={startRecording} aria-label="Start recording">
                  <span className="cp-ring" /><span className="cp-ring r2" />
                  <Ico d={IC.mic} size={46} />
                </button>
                <h2 className="cp-h2">Start your Pause</h2>
                <p className="cp-help">Sit close to your device. We&apos;ll catch what you say.</p>
                <div className="cp-spk">
                  <span><i style={{ background: whoColor(0) }} />{personA}</span>
                  {personB ? <span><i style={{ background: whoColor(1) }} />{personB}</span> : null}
                </div>
              </div>
            )}

            {uiMode === "talk" && phase === "ready" && (
              <div className="cp-ready">
                <div className="cp-ready-h">
                  <span className="cp-ready-ic"><Ico d={IC.check} size={26} /></span>
                  <div style={{ flex: 1 }}>
                    <h2 className="cp-h2" style={{ margin: 0 }}>Ready</h2>
                    <p className="cp-meta">
                      {formatCaptureDuration(secs)} recorded · about {talkWords} words
                      {personB ? ` · ${personA} and ${personB}` : ""}
                    </p>
                  </div>
                  <button type="button" className="cp-btn cp-btn-s" onClick={startRecording}>
                    <Ico d={IC.mic} size={18} /> Record more
                  </button>
                </div>
                <div className="cp-txhead"><span className="cp-h3">Transcript</span><Legend /></div>
                <div className="cp-tx">
                  <div className="cp-line" style={{ gridTemplateColumns: "1fr" }}>
                    <HighlightedText text={text} />
                  </div>
                </div>
              </div>
            )}

            {uiMode === "talk" && (phase === "rec" || phase === "paused" || phase === "trans") && (
              <div className="cp-recp">
                <div className="cp-rec-top">
                  <div>
                    <div className={"cp-live" + (phase === "rec" ? " on" : "")}>
                      <span className="cp-live-dot" />
                      {phase === "rec" ? "Listening" : phase === "paused" ? "Paused" : "Transcribing"}
                    </div>
                    <div className="cp-timer">{formatCaptureTimer(secs)}</div>
                  </div>
                  {phase !== "trans" && (
                    <div className="cp-rec-btns">
                      <button
                        type="button"
                        className="cp-btn cp-btn-s"
                        onClick={() => (phase === "rec" ? pauseRecording() : resumeRecording())}
                      >
                        <Ico d={phase === "rec" ? IC.pause : IC.play} size={18} />
                        {phase === "rec" ? "Pause" : "Resume"}
                      </button>
                      <button type="button" className="cp-btn cp-btn-ink" onClick={confirmRecording}>
                        <Ico d={IC.square} size={16} /> Stop
                      </button>
                    </div>
                  )}
                </div>
                <Waveform levels={wave} active={phase === "rec"} />
                <div className="cp-txhead"><span className="cp-h3">Live transcript</span><Legend /></div>
                {!displayTalkText.trim() ? (
                  <p className="cp-hint" style={{ padding: "8px 0" }}>Words appear here as you talk.</p>
                ) : (
                  <div className="cp-tx">
                    <div className="cp-line" style={{ gridTemplateColumns: "1fr" }}>
                      <HighlightedText text={displayTalkText} live={phase === "rec"} />
                    </div>
                    {phase === "rec" && (
                      <div className="cp-listening" style={{ paddingLeft: 0 }}>
                        <span /><span /><span />Listening
                      </div>
                    )}
                    {phase === "trans" && (
                      <div className="cp-progwrap" style={{ marginTop: 12 }}>
                        <div className="cp-prog"><i style={{ width: "55%" }} /></div>
                        <span>{dictStatus || "Turning your conversation into text..."}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {uiMode === "type" && (
              <div className="cp-type">
                <div className="cp-starters">
                  <span className="cp-over">Start with</span>
                  {CAPTURE_STARTERS.map((s) => (
                    <button key={s} type="button" className="cp-chip" onClick={() => insertStarter(s)}>
                      <Ico d={IC.plus} size={15} />{s}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={typeRef}
                  className="cp-ta"
                  value={text}
                  maxLength={TRANSCRIPT_MAX_CHARS}
                  onChange={(e) => {
                    setText(e.target.value);
                    setMode("paste");
                  }}
                  placeholder="What's going on this week?"
                  aria-label="What's going on this week"
                />
                <div className="cp-type-foot">
                  <span>{typedWords} words</span>
                  <span>Each line becomes its own item. You can fix anything later.</span>
                </div>
              </div>
            )}

            {uiMode === "paste" && !pastePresent && (
              <div
                className="cp-drop"
                tabIndex={0}
                onPaste={(e) => {
                  const t = e.clipboardData?.getData("text");
                  if (t) {
                    e.preventDefault();
                    applyPaste(t);
                  }
                }}
              >
                <span className="cp-drop-ic"><Ico d={IC.clipboard} size={30} /></span>
                <h2 className="cp-h2">Paste a text thread, school email, or notes</h2>
                <p className="cp-help">Copy it from Messages or Mail, then paste it here. We&apos;ll pull out the dates and to-dos.</p>
                <button type="button" className="cp-btn cp-btn-p" onClick={pasteFromClipboard}>
                  <Ico d={IC.clipboard} size={18} /> Paste from clipboard
                </button>
                <span className="cp-kbd">or press <kbd>⌘</kbd><kbd>V</kbd> / <kbd>Ctrl</kbd><kbd>V</kbd></span>
              </div>
            )}

            {uiMode === "paste" && pastePresent && (
              <div
                className="cp-pasted"
                onPaste={(e) => {
                  const t = e.clipboardData?.getData("text");
                  if (t) {
                    e.preventDefault();
                    applyPaste(t);
                  }
                }}
              >
                <div className="cp-pasted-h">
                  <span className="cp-src"><Ico d={IC.mail} size={16} /> Pasted text</span>
                  <span className="cp-meta">{countWords(text)} words</span>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="cp-link" onClick={pasteFromClipboard}>
                    <Ico d={IC.refresh} size={15} /> Replace
                  </button>
                  <button
                    type="button"
                    className="cp-link danger"
                    onClick={() => {
                      setText("");
                      setPastePresent(false);
                    }}
                  >
                    <Ico d={IC.trash} size={15} /> Remove
                  </button>
                </div>
                <div className="cp-email">
                  <HighlightedText text={text} />
                </div>
                <div className="cp-txhead" style={{ marginTop: "auto", paddingTop: 16 }}>
                  <span className="cp-meta">Highlighted lines become plan items</span>
                  <Legend />
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="cp-side">
          <section className={"cp-sc cp-convo" + (phase !== "idle" || uiMode !== "talk" ? " sm" : "")}>
            <div className="cp-sc-h">
              <span className="cp-over">Tonight&apos;s conversation</span>
              <span className="cp-tag">{q.tag}</span>
            </div>
            <p className="cp-q">{q.q}</p>
            <button type="button" className="cp-link" onClick={() => setQi((i) => i + 1)}>
              <Ico d={IC.shuffle} size={16} /> Draw another
            </button>
          </section>

          <section className="cp-sc">
            <div className="cp-sc-h">
              <span className="cp-h3">Things to cover</span>
              <span className="cp-count">
                {CAPTURE_TOPIC_LIST.filter((t) => coveredTopics.has(t.k)).length} of {CAPTURE_TOPIC_LIST.length}
              </span>
            </div>
            <ul className="cp-topics">
              {CAPTURE_TOPIC_LIST.map((t) => {
                const on = coveredTopics.has(t.k);
                return (
                  <li key={t.k} className={on ? "on" : ""}>
                    <button
                      type="button"
                      className="cp-tick"
                      aria-pressed={on}
                      onClick={() => toggleTopic(t.k)}
                    >
                      {on ? <Ico d={IC.check} size={14} /> : null}
                    </button>
                    <span className="cp-tl">{t.k}</span>
                    {on ? <span className="cp-came">Came up</span> : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="cp-sc">
            <div className="cp-sc-h">
              <span className="cp-h3">{uiMode === "talk" ? "We're hearing" : "We're finding"}</span>
              {phase === "rec" ? <span className="cp-livepill"><i />Live</span> : null}
            </div>
            {Object.values(counts).every((n) => n === 0) ? (
              <p className="cp-hint">Plan items appear here as you talk. Nothing is saved until you review it.</p>
            ) : (
              <div className="cp-counts">
                {["appt", "todo", "dec", "note", "tt"].map((k) => (
                  <div key={k} className={"cp-ct" + (k === "tt" ? " tt" : "") + (counts[k] ? "" : " zero")}>
                    <span
                      className="cp-ct-ic"
                      style={{ color: CAPTURE_TYPE_META[k].color, background: `${CAPTURE_TYPE_META[k].color}1A` }}
                    >
                      <Ico d={typeIcon(k)} size={16} />
                    </span>
                    <b>{counts[k]}</b>
                    <span>{CAPTURE_TYPE_META[k].label}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className={"cp-ttrem" + (counts.tt > 0 ? " has" : "")}>
            <span className="cp-ttrem-ic">
              <Ico d={counts.tt > 0 ? IC.check : IC.heart} size={16} fill={counts.tt === 0} />
            </span>
            {counts.tt > 0
              ? "Time Together is on your plan this week"
              : "Don't forget to plan your time together this week"}
          </div>
        </aside>
      </div>

      <footer className="cp-bar">
        <div className="cp-bar-l">
          <button
            type="button"
            className="cp-back"
            onClick={() => {
              if ((phase === "rec" || phase === "paused") && phase !== "trans") cancelRecording();
              onBack();
            }}
          >
            <Ico d={IC.chevL} size={18} /> Back
          </button>
          <span className="cp-vr" />
          <div className="cp-status">
            {phase === "trans" ? (
              <span>Turning your conversation into text...</span>
            ) : phase === "rec" || phase === "paused" ? (
              <span className="cp-recst">
                <i />{phase === "rec" ? "Recording" : "Paused"} · {formatCaptureDuration(secs)}
              </span>
            ) : phase === "ready" && uiMode === "talk" ? (
              <>
                <span className="cp-readyst"><Ico d={IC.check} size={18} /> Ready</span>
                <i>·</i>
                <span>{formatCaptureDuration(secs)} recorded · about {talkWords} words</span>
              </>
            ) : uiMode === "type" && typedWords ? (
              <span>{typedWords} words typed</span>
            ) : uiMode === "paste" && pastePresent ? (
              <span>Text pasted</span>
            ) : (
              <span>Nothing captured yet</span>
            )}
          </div>
        </div>
        {!canBuild ? (
          <button type="button" className="cp-btn cp-btn-off" disabled>
            {phase === "trans"
              ? "Transcribing…"
              : busy
                ? "Stop recording to continue"
                : "Talk or type to continue"}
          </button>
        ) : (
          <button type="button" className="cp-btn cp-btn-p lg" onClick={handleBuild}>
            Build our plan <Ico d={IC.arrow} size={20} />
          </button>
        )}
      </footer>
    </div>
  );
}
