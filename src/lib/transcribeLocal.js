let pipelinePromise = null;

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

/** Decode MediaRecorder blobs via Web Audio (most reliable in Brave for webm/opus). */
async function decodeAudioBlob(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  if (arrayBuffer.byteLength < 200) {
    throw new Error("Recording too short — speak for at least 2 seconds.");
  }

  const audioCtx = new AudioContext();
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const samples = decoded.getChannelData(0);
    if (!samples?.length || samples.length < 8000) {
      throw new Error("Recording too short — speak for at least 2 seconds.");
    }
    return decoded.sampleRate === 16000
      ? Float32Array.from(samples)
      : resampleLinear(samples, decoded.sampleRate, 16000);
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const { read_audio } = await import("@xenova/transformers");
      const audio = await read_audio(url, 16000);
      if (!audio?.length || audio.length < 8000) {
        throw new Error("Recording too short — speak for at least 2 seconds.");
      }
      return audio;
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
  // Brave lacks cross-origin isolation — multithreaded WASM + proxy workers hang at inference.
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

/** On-device Whisper when server OPENAI_API_KEY is not configured. */
export async function transcribeLocally(blob, { onProgress, onStatus } = {}) {
  const transcriber = await loadTransformers(onProgress);
  onStatus?.("Turning speech into text…");

  const audio = await decodeAudioBlob(blob);

  // Short dictation clips: skip chunk_length_s — it can stall inference in browser WASM.
  const out = await withTimeout(
    transcriber(audio, {
      language: "english",
      task: "transcribe",
    }),
    90000,
    "Transcription timed out. Try again or use Write or paste."
  );

  const text = extractText(out);
  if (!text) throw new Error("No speech detected — check mic input and try again.");
  return text;
}
