"use client";

const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

type Embedder = (
  text: string,
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ data: Float32Array }>;

let embedder: Embedder | null = null;
let embedderPromise: Promise<Embedder> | null = null;
let embedderError: Error | null = null;

async function getEmbedder() {
  if (embedderError) {
    throw embedderError;
  }

  if (embedder) {
    return embedder;
  }

  if (!embedderPromise) {
    embedderPromise = (async () => {
      try {
        const { env, pipeline } = await import("@huggingface/transformers");

        env.allowRemoteModels = true;
        env.allowLocalModels = false;
        env.useBrowserCache = true;

        const model = await pipeline("feature-extraction", EMBEDDING_MODEL);
        embedder = model as Embedder;
        return embedder;
      } catch (error) {
        embedderError =
          error instanceof Error ? error : new Error("Failed to load embedder");
        throw embedderError;
      }
    })();
  }

  return embedderPromise;
}

export async function embedText(text: string): Promise<number[] | null> {
  try {
    const model = await getEmbedder();
    const output = await model(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  } catch {
    return null;
  }
}
