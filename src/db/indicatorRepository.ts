import type {
  ChunkIndicators,
  SessionIndicators,
} from "@/src/types/indicators";
import { logDbEvent } from "@/services/dbLog";
import { getRecordingDbAsync } from "@/services/recordingDb";

export type ChunkIndicatorRow = {
  session_id: string;
  chunk_index: number;
  chunk_start_ms: number;
  chunk_duration_ms: number;
  mean_rms: number;
  std_rms: number;
  min_rms: number;
  max_rms: number;
  pause_count: number;
  total_pause_duration_ms: number;
  longest_pause_ms: number;
  speech_ratio: number;
  speech_frame_count: number;
  silence_frame_count: number;
  chunk_speech_ratio: number;
  noise_floor: number | null;
  silence_threshold: number | null;
};

export type SessionIndicatorRow = {
  session_id: string;
  total_chunks: number;
  session_duration_ms: number;
  computed_at_ms: number;
  mean_rms_mean: number;
  mean_rms_std: number;
  mean_rms_min: number;
  mean_rms_max: number;
  total_pause_count: number;
  total_pause_duration_ms: number;
  longest_pause_ms: number;
  mean_pauses_per_chunk: number;
  session_speech_ratio: number;
  mean_chunk_speech_ratio: number;
};

export type IndicatorRowsForSession = {
  sessionIndicators: SessionIndicatorRow | null;
  chunkIndicators: ChunkIndicatorRow[];
};

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const average = mean(values);
  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

export async function saveChunkIndicators(
  sessionId: string,
  chunk: ChunkIndicators,
): Promise<void> {
  try {
    const db = await getRecordingDbAsync();

    await db.runAsync(
      `INSERT OR REPLACE INTO chunk_indicators (
        session_id,
        chunk_index,
        chunk_start_ms,
        chunk_duration_ms,
        mean_rms,
        std_rms,
        min_rms,
        max_rms,
        pause_count,
        total_pause_duration_ms,
        longest_pause_ms,
        speech_ratio,
        speech_frame_count,
        silence_frame_count,
        chunk_speech_ratio,
        noise_floor,
        silence_threshold
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sessionId,
      chunk.chunkIndex,
      chunk.chunkStartMs,
      chunk.chunkDurationMs,
      chunk.energy.meanRms,
      chunk.energy.stdRms,
      chunk.energy.minRms,
      chunk.energy.maxRms,
      chunk.pause.pauseCount,
      chunk.pause.totalPauseDurationMs,
      chunk.pause.longestPauseMs,
      chunk.pause.speechRatio,
      chunk.speechActivity.speechFrameCount,
      chunk.speechActivity.silenceFrameCount,
      chunk.speechActivity.chunkSpeechRatio,
      null,
      null,
    );
    logDbEvent("indicator_chunk_saved", {
      sessionId,
      details: {
        chunkIndex: chunk.chunkIndex,
        meanRms: chunk.energy.meanRms,
        speechRatio: chunk.speechActivity.chunkSpeechRatio,
      },
    });
  } catch (error) {
    console.error("[Cadence] Failed to save chunk indicators:", error);
    throw error;
  }
}

export async function saveSessionIndicators(
  indicators: SessionIndicators,
): Promise<void> {
  try {
    const db = await getRecordingDbAsync();
    const chunkMeanRms = indicators.chunkIndicators.map(
      (chunk) => chunk.energy.meanRms,
    );
    const chunkSpeechRatios = indicators.chunkIndicators.map(
      (chunk) => chunk.speechActivity.chunkSpeechRatio,
    );
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT OR REPLACE INTO session_indicators (
          session_id,
          total_chunks,
          session_duration_ms,
          computed_at_ms,
          mean_rms_mean,
          mean_rms_std,
          mean_rms_min,
          mean_rms_max,
          total_pause_count,
          total_pause_duration_ms,
          longest_pause_ms,
          mean_pauses_per_chunk,
          session_speech_ratio,
          mean_chunk_speech_ratio
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        indicators.sessionId,
        indicators.totalChunks,
        indicators.sessionDurationMs,
        indicators.computedAtMs,
        indicators.energy.meanRms,
        standardDeviation(chunkMeanRms),
        chunkMeanRms.length > 0 ? Math.min(...chunkMeanRms) : 0,
        chunkMeanRms.length > 0 ? Math.max(...chunkMeanRms) : 0,
        indicators.pause.totalPauses,
        indicators.pause.totalPauseDurationMs,
        indicators.pause.longestPauseMs,
        indicators.totalChunks > 0
          ? indicators.pause.totalPauses / indicators.totalChunks
          : 0,
        indicators.speechActivity.teacherSpeechActivityRatio,
        mean(chunkSpeechRatios),
      );

      await db.runAsync(
        `UPDATE recording_sessions
         SET status = 'completed',
             error_message = NULL,
             updated_at = ?
         WHERE id = ?`,
        now,
        indicators.sessionId,
      );
    });
    logDbEvent("indicator_session_saved", {
      sessionId: indicators.sessionId,
      details: {
        totalChunks: indicators.totalChunks,
        sessionDurationMs: indicators.sessionDurationMs,
        sessionSpeechRatio:
          indicators.speechActivity.teacherSpeechActivityRatio,
      },
    });
  } catch (error) {
    console.error("[Cadence] Failed to save session indicators:", error);
    throw error;
  }
}

export async function getIndicatorRowsForSession(
  sessionId: string,
): Promise<IndicatorRowsForSession> {
  try {
    const db = await getRecordingDbAsync();
    const sessionIndicators = await db.getFirstAsync<SessionIndicatorRow>(
      "SELECT * FROM session_indicators WHERE session_id = ?",
      sessionId,
    );
    const chunkIndicators = await db.getAllAsync<ChunkIndicatorRow>(
      `SELECT * FROM chunk_indicators
       WHERE session_id = ?
       ORDER BY chunk_index ASC`,
      sessionId,
    );

    logDbEvent("indicator_rows_loaded", {
      sessionId,
      details: {
        hasSessionIndicators: Boolean(sessionIndicators),
        chunkCount: chunkIndicators.length,
      },
    });

    return {
      sessionIndicators: sessionIndicators ?? null,
      chunkIndicators,
    };
  } catch (error) {
    console.error("[Cadence] Failed to load indicator rows:", error);
    throw error;
  }
}
