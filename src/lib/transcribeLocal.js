let pipelinePromise = null;

const SAMPLE_RATE = 16000;
const MIN_SAMPLES = SAMPLE_RATE * 2; // 2 seconds at 16 kHz

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function resampleLinear(samples, fromRate, toRate) {
  if (fromRate === toRate) return Float32Array.from(samples);
  const ratio = fromRate / toRate;
  const newLength = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIdx = i * ratio;
    const idx = Math.floor(srcIdx);
    const frac = srcIdx - idx;
    const a = samples[idx] ?? 0;
    const b = samples[idx + 1] ?? a;
    out[i] = a + frac * (b - a);
  }
  return out;
}

function toMonoBuffer(decoded) {
  if (decoded.numberOfChannels === 1) return decoded.getChannelData(0);
  const ch0 = decoded.getChannelData(0);
  const ch1 = decoded.getChannelData(1);
  const mono = new Float32Array(ch0.length);
  for (let i = 0; i < ch0.length; i++) mono[i] = (ch0[i] + (ch1[i] ?? 0)) / 2;
  return mono;
}

function normalizeAmplitude(samples) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak < 0.0005) {
    throw new Error("No speech detected — check mic input and try again.");
  }
  if (peak >= 0.15) return samples;
  const scale = 0.85 / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * scale;
  return out;
}

/** Decode MediaRecorder blob → mono Float32 @ 16 kHz (Whisper requirement). */
async function decodeAudioBlob(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  if (arrayBuffer.byteLength < 200) {
    throw new Error("Recording too short — speak for at least 2 seconds.");
  }

  // Resample during decode — manual resample alone often yields empty Whisper output.
  const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    let samples = toMonoBuffer(decoded);
    if (decoded.sampleRate !== SAMPLE_RATE) {
      samples = resampleLinear(samples, decoded.sampleRate, SAMPLE_RATE);
    } else {
      samples = Float32Array.from(samples);
    }
    if (samples.length < MIN_SAMPLES) {
      throw new Error("Recording too short — speak for at least 2 seconds.");
    }
    return normalizeAmplitude(samples);
  } catch (err) {
    if (err.message?.includes("No speech detected") || err.message?.includes("too short")) throw err;
    const url = URL.createObjectURL(blob);
    try {
      const { read_audio } = await import("@xenova/transformers");
      const audio = await read_audio(url, SAMPLE_RATE);
      if (!audio?.length || audio.length < MIN_SAMPLES) {
        throw new Error("Recording too short — speak for at least 2 seconds.");
      }
      return normalizeAmplitude(audio);
    } finally {
      URL.revokeObjectURL(url);
    }
  } finally {
    await audioCtx.close().catch(() => {});
  }
}

async function loadTransformers(onProgress) {
  const { pipeline, env } = await import("@xenova/transformers");
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.allowRemoteModels = true;
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.numThreads = 1;

  if (!pipelinePromise) {
    pipelinePromise = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
      quantized: true,
      progress_callback: onProgress,
    });
  }
  return pipelinePromise;
}

function extractText(out) {
  if (!out) return "";
  if (typeof out === "string") return out.trim();
  if (typeof out.text === "string") return out.text.trim();
  if (Array.isArray(out)) return out.map(extractText).filter(Boolean).join(" ").trim();
  if (out.chunks && Array.isArray(out.chunks)) {
    return out.chunks.map((c) => c?.text || "").join(" ").trim();
  }
  return "";
}

function cleanTranscript(text) {
  const t = (text || "").trim();
  if (!t || /^\[BLANK_AUDIO\]$/i.test(t) || /^\(silence\)$/i.test(t)) return "";
  return t;
}

async function runTranscriber(transcriber, input) {
  return withTimeout(
    transcriber(input, { task: "transcribe" }),
    90000,
    "Transcription timed out. Try again or use Write or paste."
  );
}

/** On-device Whisper when server GROQ_API_KEY is not configured. */
export async function transcribeLocally(blob, { onProgress, onStatus } = {}) {
  const transcriber = await loadTransformers(onProgress);
  onStatus?.("Turning speech into text…");

  // Prefer blob URL — transformers.js read_audio handles webm/opus reliably.
  const url = URL.createObjectURL(blob);
  try {
    const fromUrl = cleanTranscript(extractText(await runTranscriber(transcriber, url)));
    if (fromUrl) return fromUrl;
  } catch {
    /* fall through to manual decode */
  } finally {
    URL.revokeObjectURL(url);
  }

  const audio = await decodeAudioBlob(blob);
  const fromPcm = cleanTranscript(extractText(await runTranscriber(transcriber, audio)));
  if (!fromPcm) throw new Error("No speech detected — check mic input and try again.");
  return fromPcm;
}
