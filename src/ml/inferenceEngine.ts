import type { TFLiteModel } from "@/src/ml/modelLoader";

const EXPECTED_CHUNK_LENGTH = 160000;

/**
 * @deprecated Phase 4B.1 introduces the stream-and-discard result type in
 * src/types/indicators.ts. This Phase 3 shape is kept until the 4B.2
 * inference refactor removes stored embeddings from the runtime pipeline.
 */
export interface ChunkInferenceResult {
  chunkIndex: number;
  inferenceTimeMs: number;
  embeddings: Float32Array;
}

/**
 * @deprecated Phase 4B.1 introduces the stream-and-discard result type in
 * src/types/indicators.ts. This Phase 3 shape is kept until the 4B.2
 * inference refactor removes stored embeddings from the runtime pipeline.
 */
export interface SessionInferenceResult {
  totalChunks: number;
  totalInferenceTimeMs: number;
  averageChunkTimeMs: number;
  results: ChunkInferenceResult[];
}

function toExactArrayBuffer(chunk: Float32Array): ArrayBuffer {
  const start = chunk.byteOffset;
  const end = start + chunk.byteLength;

  if (chunk.buffer instanceof ArrayBuffer) {
    return chunk.buffer.slice(start, end);
  }

  const bytes = new Uint8Array(chunk.byteLength);
  bytes.set(new Uint8Array(chunk.buffer, start, chunk.byteLength));
  return bytes.buffer;
}

export async function runSessionInference(
  model: TFLiteModel,
  chunks: Float32Array[],
): Promise<SessionInferenceResult> {
  const results: ChunkInferenceResult[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];

    if (chunk.length !== EXPECTED_CHUNK_LENGTH) {
      console.warn(
        `[Cadence] Skipping chunk ${index}: expected ${EXPECTED_CHUNK_LENGTH} samples, received ${chunk.length}.`,
      );
      continue;
    }

    const startTime = Date.now();
    const outputs = await model.run([toExactArrayBuffer(chunk)]);
    const endTime = Date.now();
    const inferenceTimeMs = endTime - startTime;
    const output = outputs[0];

    if (!output) {
      throw new Error(`Model did not return an output for chunk ${index}.`);
    }

    const embeddings = new Float32Array(output);

    if (embeddings.length === 0) {
      throw new Error(`Model returned an empty output for chunk ${index}.`);
    }

    const preview = Array.from(embeddings.slice(0, 3)).join(", ");
    console.log(
      `[Cadence] Chunk ${index}/${chunks.length}: inference=${inferenceTimeMs}ms | output[0..2]=[${preview}]`,
    );

    results.push({
      chunkIndex: index,
      inferenceTimeMs,
      embeddings,
    });
  }

  const totalInferenceTimeMs = results.reduce(
    (total, result) => total + result.inferenceTimeMs,
    0,
  );
  const averageChunkTimeMs =
    results.length > 0 ? totalInferenceTimeMs / results.length : 0;

  return {
    totalChunks: chunks.length,
    totalInferenceTimeMs,
    averageChunkTimeMs,
    results,
  };
}
