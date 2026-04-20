import * as Crypto from "expo-crypto";

import type { AnalysisJob, AnalysisJobStatus } from "@/constants/types";
import { getRecordingDbAsync } from "@/services/recordingDb";

type AnalysisJobRow = {
  id: string;
  recording_session_id: string;
  status: AnalysisJobStatus;
  processed_audio_path: string | null;
  processed_sample_rate: number | null;
  processed_channel_count: number | null;
  processed_duration_ms: number | null;
  processed_frame_count: number | null;
  processed_file_size_bytes: number | null;
  attempt_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type AnalysisJobPatch = Partial<
  Pick<
    AnalysisJob,
    | "status"
    | "processedAudioPath"
    | "processedSampleRate"
    | "processedChannelCount"
    | "processedDurationMs"
    | "processedFrameCount"
    | "processedFileSizeBytes"
    | "attemptCount"
    | "errorMessage"
  >
>;

function rowToAnalysisJob(row: AnalysisJobRow): AnalysisJob {
  return {
    id: row.id,
    recordingSessionId: row.recording_session_id,
    status: row.status,
    processedAudioPath: row.processed_audio_path,
    processedSampleRate: row.processed_sample_rate,
    processedChannelCount: row.processed_channel_count,
    processedDurationMs: row.processed_duration_ms,
    processedFrameCount: row.processed_frame_count,
    processedFileSizeBytes: row.processed_file_size_bytes,
    attemptCount: row.attempt_count,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAnalysisJobForRecordingAsync(
  recordingSessionId: string,
) {
  const db = await getRecordingDbAsync();
  const row = await db.getFirstAsync<AnalysisJobRow>(
    "SELECT * FROM analysis_jobs WHERE recording_session_id = ?",
    recordingSessionId,
  );

  return row ? rowToAnalysisJob(row) : null;
}

export async function getOrCreateAnalysisJobAsync(recordingSessionId: string) {
  const existing = await getAnalysisJobForRecordingAsync(recordingSessionId);

  if (existing) {
    return existing;
  }

  const db = await getRecordingDbAsync();
  const now = new Date().toISOString();
  const job: AnalysisJob = {
    id: Crypto.randomUUID(),
    recordingSessionId,
    status: "queued",
    processedAudioPath: null,
    processedSampleRate: null,
    processedChannelCount: null,
    processedDurationMs: null,
    processedFrameCount: null,
    processedFileSizeBytes: null,
    attemptCount: 0,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    `INSERT INTO analysis_jobs (
      id,
      recording_session_id,
      status,
      processed_audio_path,
      processed_sample_rate,
      processed_channel_count,
      processed_duration_ms,
      processed_frame_count,
      processed_file_size_bytes,
      attempt_count,
      error_message,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    job.id,
    job.recordingSessionId,
    job.status,
    job.processedAudioPath,
    job.processedSampleRate,
    job.processedChannelCount,
    job.processedDurationMs,
    job.processedFrameCount,
    job.processedFileSizeBytes,
    job.attemptCount,
    job.errorMessage,
    job.createdAt,
    job.updatedAt,
  );

  return job;
}

export async function updateAnalysisJobAsync(
  recordingSessionId: string,
  patch: AnalysisJobPatch,
) {
  const db = await getRecordingDbAsync();
  const existing = await getOrCreateAnalysisJobAsync(recordingSessionId);
  const next: AnalysisJob = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await db.runAsync(
    `UPDATE analysis_jobs
     SET status = ?,
         processed_audio_path = ?,
         processed_sample_rate = ?,
         processed_channel_count = ?,
         processed_duration_ms = ?,
         processed_frame_count = ?,
         processed_file_size_bytes = ?,
         attempt_count = ?,
         error_message = ?,
         updated_at = ?
     WHERE recording_session_id = ?`,
    next.status,
    next.processedAudioPath,
    next.processedSampleRate,
    next.processedChannelCount,
    next.processedDurationMs,
    next.processedFrameCount,
    next.processedFileSizeBytes,
    next.attemptCount,
    next.errorMessage,
    next.updatedAt,
    recordingSessionId,
  );

  return next;
}

export async function deleteAnalysisJobForRecordingAsync(
  recordingSessionId: string,
) {
  const db = await getRecordingDbAsync();
  await db.runAsync(
    "DELETE FROM analysis_jobs WHERE recording_session_id = ?",
    recordingSessionId,
  );
}
