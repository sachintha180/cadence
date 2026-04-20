import * as SQLite from "expo-sqlite";

import type {
  RecordingSession,
  RecordingSessionStatus,
} from "@/constants/types";

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
      `);

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

  return rows.map(rowToRecordingSession);
}

export async function deleteRecordingSessionAsync(id: string) {
  const db = await getRecordingDbAsync();
  await db.runAsync("DELETE FROM recording_sessions WHERE id = ?", id);
}
