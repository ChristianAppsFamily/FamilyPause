let pipelinePromise = null;

function mixToMono(buffer) {
  const len = buffer.length;
  const out = new Float32Array(len);
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < len; i += 1) out[i] += ch[i] / buffer.numberOfChannels;
  }
  return out;
}

function resample(input, fromRate, toRate) {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const newLen = Math.round(input.length / ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i += 1) {
    const idx = i * ratio;
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, input.length - 1);
    const frac = idx - lo;
    out[i] = input[lo] * (1 - frac) + input[hi] * frac;
  }
  return out;
}

async function blobToMono16k(blob) {
  const ctx = new AudioContext();
  try {
    const ab = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(ab.slice(0));
    const mono = decoded.numberOfChannels > 1 ? mixToMono(decoded) : decoded.getChannelData(0);
    return resample(mono, decoded.sampleRate, 16000);
  } finally {
    await ctx.close();
  }
}

async function getPipeline(onProgress) {
  if (!pipelinePromise) {
    const { pipeline, env } = await import("@xenova/transformers");
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    pipelinePromise = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
      progress_callback: onProgress,
    });
  }
  return pipelinePromise;
}

/** On-device Whisper when server OPENAI_API_KEY is not configured. */
export async function transcribeLocally(blob, { onProgress } = {}) {
  const transcriber = await getPipeline(onProgress);
  const audio = await blobToMono16k(blob);
  const out = await transcriber(audio, {
    language: "english",
    task: "transcribe",
    sampling_rate: 16000,
  });
  return (out?.text || "").trim();
}
