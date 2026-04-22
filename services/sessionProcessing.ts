import type { TFLiteModel } from "@/src/ml/modelLoader";
import { preprocessRecordingForInferenceAsync } from "@/services/audioPreprocessing";
import { updateAnalysisJobAsync } from "@/services/analysisDb";
import { getRecordingSessionAsync } from "@/services/recordingDb";
import { deleteIndicatorsForSession } from "@/src/db/indicatorRepository";
import { indicatorExtractionCallback } from "@/src/ml/indicatorExtractor";
import { runSessionInference } from "@/src/ml/inferenceEngine";
import type { SessionInferenceResult } from "@/src/types/indicators";

export type ProcessingStatus =
  | "loading_model"
  | "model_loaded"
  | "preprocessing"
  | "running_inference"
  | "completed";

export type ProcessRecordingSessionOptions = {
  sessionId: string;
  getModel: () => Promise<TFLiteModel>;
  onStatus?: (status: ProcessingStatus) => void;
  onInferenceProgress?: (chunkIndex: number, total: number) => void;
};

export async function processRecordingSessionAsync({
  sessionId,
  getModel,
  onStatus,
  onInferenceProgress,
}: ProcessRecordingSessionOptions): Promise<SessionInferenceResult> {
  try {
    onStatus?.("loading_model");
    const model = await getModel();
    onStatus?.("model_loaded");

    onStatus?.("preprocessing");
    const { job, chunks } =
      await preprocessRecordingForInferenceAsync(sessionId);

    const session = await getRecordingSessionAsync(sessionId);
    const processedDurationMs = job.processedDurationMs ?? session?.durationMs;

    if (!processedDurationMs || processedDurationMs <= 0) {
      throw new Error("Preprocessing did not return a valid duration.");
    }

    onStatus?.("running_inference");
    await deleteIndicatorsForSession(sessionId);
    const result = await runSessionInference(
      model,
      chunks,
      sessionId,
      processedDurationMs,
      indicatorExtractionCallback,
      onInferenceProgress,
    );

    onStatus?.("completed");
    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Processing failed.";
    await updateAnalysisJobAsync(sessionId, {
      status: "failed",
      errorMessage: message,
    });
    throw error;
  }
}
