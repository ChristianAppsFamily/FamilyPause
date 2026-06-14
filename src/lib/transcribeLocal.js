let pipelinePromise = null;

async function loadTransformers(onProgress) {
  const { pipeline, env, read_audio } = await import("@xenova/transformers");
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.allowRemoteModels = true;
  env.backends.onnx.wasm.proxy = true;
  env.backends.onnx.wasm.numThreads = 1;

  if (!pipelinePromise) {
    pipelinePromise = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
      quantized: true,
      progress_callback: onProgress,
    });
  }
  return { transcriber: await pipelinePromise, read_audio };
}

function extractText(out) {
  if (!out) return "";
  if (typeof out === "string") return out.trim();
  if (typeof out.text === "string") return out.text.trim();
  if (Array.isArray(out)) return out.map(extractText).filter(Boolean).join(" ").trim();
  return "";
}

/** On-device Whisper when server OPENAI_API_KEY is not configured. */
export async function transcribeLocally(blob, { onProgress } = {}) {
  const { transcriber, read_audio } = await loadTransformers(onProgress);
  const url = URL.createObjectURL(blob);

  try {
    const audio = await read_audio(url, 16000);
    if (!audio?.length || audio.length < 8000) {
      throw new Error("Recording too short — speak for at least 2 seconds.");
    }

    const out = await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: "english",
      task: "transcribe",
    });

    const text = extractText(out);
    if (!text) throw new Error("No speech detected — check mic input and try again.");
    return text;
  } finally {
    URL.revokeObjectURL(url);
  }
}
