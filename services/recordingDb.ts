import * as SQLite from "expo-sqlite";

import type {
  RecordingSession,
  RecordingSessionStatus,
} from "@/constants/types";
import { logDbEvent } from "@/services/dbLog";

type RecordingSessionRow = {
  id: string;
  created_at: string;
  audio_path: string;
  duration_ms: number;
  status: RecordingSessionStatus;
  file_size_bytes: number | null;
  title: string | null;
  error_message: string | null;
  updated_at: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function rowToRecordingSession(row: RecordingSessionRow): RecordingSession {
  return {
    id: row.id,
    createdAt: row.created_at,
    audioPath: row.audio_path,
    durationMs: row.duration_ms,
    status: row.status,
    fileSizeBytes: row.file_size_bytes,
    title: row.title,
    errorMessage: row.error_message,
    updatedAt: row.updated_at,
  };
}

export async function getRecordingDbAsync() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("cadence.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS recording_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          created_at TEXT NOT NULL,
          audio_path TEXT NOT NULL,
          duration_ms INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL,
          file_size_bytes INTEGER,
          title TEXT,
          error_message TEXT,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS analysis_jobs (
          id TEXT PRIMARY KEY NOT NULL,
          recording_session_id TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL,
          processed_audio_path TEXT,
          processed_sample_rate INTEGER,
          processed_channel_count INTEGER,
          processed_duration_ms INTEGER,
          processed_frame_count INTEGER,
          processed_file_size_bytes INTEGER,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          error_message TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (recording_session_id)
            REFERENCES recording_sessions(id)
            ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_analysis_jobs_recording_session_id
          ON analysis_jobs(recording_session_id);

        CREATE TABLE IF NOT EXISTS chunk_indicators (
          session_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          chunk_start_ms INTEGER NOT NULL,
          chunk_duration_ms INTEGER NOT NULL,
          mean_rms REAL NOT NULL,
          std_rms REAL NOT NULL,
          min_rms REAL NOT NULL,
          max_rms REAL NOT NULL,
          pause_count INTEGER NOT NULL,
          total_pause_duration_ms INTEGER NOT NULL,
          longest_pause_ms INTEGER NOT NULL,
          speech_ratio REAL NOT NULL,
          speech_frame_count INTEGER NOT NULL,
          silence_frame_count INTEGER NOT NULL,
          chunk_speech_ratio REAL NOT NULL,
          noise_floor REAL,
          silence_threshold REAL,
          PRIMARY KEY (session_id, chunk_index),
          FOREIGN KEY (session_id)
            REFERENCES recording_sessions(id)
            ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS session_indicators (
          session_id TEXT PRIMARY KEY,
          total_chunks INTEGER NOT NULL,
          session_duration_ms INTEGER NOT NULL,
          computed_at_ms INTEGER NOT NULL,
          mean_rms_mean REAL NOT NULL,
          mean_rms_std REAL NOT NULL,
          mean_rms_min REAL NOT NULL,
          mean_rms_max REAL NOT NULL,
          total_pause_count INTEGER NOT NULL,
          total_pause_duration_ms INTEGER NOT NULL,
          longest_pause_ms INTEGER NOT NULL,
          mean_pauses_per_chunk REAL NOT NULL,
          session_speech_ratio REAL NOT NULL,
          mean_chunk_speech_ratio REAL NOT NULL,
          FOREIGN KEY (session_id)
            REFERENCES recording_sessions(id)
            ON DELETE CASCADE
        );
      `);

      logDbEvent("database_initialized");

      return db;
    });
  }

  return dbPromise;
}

export async function createRecordingSessionAsync(session: RecordingSession) {
  const db = await getRecordingDbAsync();

  await db.runAsync(
    `INSERT INTO recording_sessions (
      id,
      created_at,
      audio_path,
      duration_ms,
      status,
      file_size_bytes,
      title,
      error_message,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    session.id,
    session.createdAt,
    session.audioPath,
    session.durationMs,
    session.status,
    session.fileSizeBytes,
    session.title,
    session.errorMessage,
    session.updatedAt,
  );
  logDbEvent("recording_session_created", {
    sessionId: session.id,
    details: {
      status: session.status,
      durationMs: session.durationMs,
      fileSizeBytes: session.fileSizeBytes,
    },
  });
}

export async function updateRecordingSessionAsync(
  id: string,
  patch: Partial<
    Pick<
      RecordingSession,
      | "audioPath"
      | "durationMs"
      | "status"
      | "fileSizeBytes"
      | "title"
      | "errorMessage"
    >
  >,
) {
  const db = await getRecordingDbAsync();
  const existing = await getRecordingSessionAsync(id);

  if (!existing) {
    logDbEvent("recording_session_update_skipped", {
      sessionId: id,
      details: { reason: "missing" },
    });
    return;
  }

  const next: RecordingSession = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await db.runAsync(
    `UPDATE recording_sessions
     SET audio_path = ?,
         duration_ms = ?,
         status = ?,
         file_size_bytes = ?,
         title = ?,
         error_message = ?,
         updated_at = ?
     WHERE id = ?`,
    next.audioPath,
    next.durationMs,
    next.status,
    next.fileSizeBytes,
    next.title,
    next.errorMessage,
    next.updatedAt,
    id,
  );
  logDbEvent("recording_session_updated", {
    sessionId: id,
    details: {
      status: next.status,
      durationMs: next.durationMs,
      fileSizeBytes: next.fileSizeBytes,
    },
  });
}

export async function getRecordingSessionAsync(id: string) {
  const db = await getRecordingDbAsync();
  const row = await db.getFirstAsync<RecordingSessionRow>(
    "SELECT * FROM recording_sessions WHERE id = ?",
    id,
  );

  return row ? rowToRecordingSession(row) : null;
}

export async function listRecordingSessionsAsync() {
  const db = await getRecordingDbAsync();
  const rows = await db.getAllAsync<RecordingSessionRow>(
    "SELECT * FROM recording_sessions WHERE status != 'failed' ORDER BY created_at DESC",
  );

  logDbEvent("recording_sessions_listed", {
    details: { count: rows.length },
  });

  return rows.map(rowToRecordingSession);
}

export async function deleteRecordingSessionAsync(id: string) {
  const db = await getRecordingDbAsync();
  await db.runAsync("DELETE FROM recording_sessions WHERE id = ?", id);
  logDbEvent("recording_session_deleted", { sessionId: id });
}

export async function deleteRecordingRowsAsync(id: string) {
  const db = await getRecordingDbAsync();

  logDbEvent("recording_rows_cleanup_started", { sessionId: id });

  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        "DELETE FROM chunk_indicators WHERE session_id = ?",
        id,
      );
      await db.runAsync(
        "DELETE FROM session_indicators WHERE session_id = ?",
        id,
      );
      await db.runAsync(
        "DELETE FROM analysis_jobs WHERE recording_session_id = ?",
        id,
      );
      await db.runAsync("DELETE FROM recording_sessions WHERE id = ?", id);
    });

    logDbEvent("recording_rows_cleanup_completed", { sessionId: id });
  } catch (error) {
    logDbEvent("recording_rows_cleanup_failed", {
      sessionId: id,
      details: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
