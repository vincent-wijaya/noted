import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline("feature-extraction", EMBEDDING_MODEL);
  }

  return embedder;
}

export async function embedText(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}
