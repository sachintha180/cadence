import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useModel } from "@/components/ModelProvider";
import { useToast } from "@/components/ToastProvider";
import colors from "@/constants/colors";
import type { RecordingSession } from "@/constants/types";
import { formatDateTime } from "@/constants/helpers";
import { logImportEvent } from "@/services/importLog";
import { updateAnalysisJobAsync } from "@/services/analysisDb";
import { processRecordingSessionAsync } from "@/services/sessionProcessing";
import { createRecordingSessionAsync } from "@/services/recordingDb";
import {
  copyImportedRecordingAsync,
  deleteRecordingFileAsync,
  getSupportedImportExtension,
  validateImportedRecordingFileAsync,
} from "@/services/recordingFiles";

type ImportState =
  | "idle"
  | "selecting"
  | "copying"
  | "validating"
  | "processing"
  | "completed"
  | "failed";

function fallbackTitle(createdAt: string) {
  return `Imported Recording - ${formatDateTime(createdAt)}`;
}

function getDisplayName(name?: string | null) {
  if (!name) {
    return null;
  }

  return name.trim() || null;
}

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { getModel, state: modelState } = useModel();
  const [importState, setImportState] = useState<ImportState>("idle");
  const [statusLabel, setStatusLabel] = useState("Choose an audio file.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedRef = useRef(false);

  async function processImport() {
    let copiedPath: string | null = null;
    let createdSession: RecordingSession | null = null;

    try {
      setErrorMessage(null);
      setImportState("selecting");
      setStatusLabel("Opening file picker...");
      logImportEvent("picker_opened");

      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        logImportEvent("picker_cancelled");
        router.back();
        return;
      }

      const asset = result.assets[0];

      if (!asset) {
        throw new Error("No file was selected.");
      }

      const displayName = getDisplayName(asset.name);
      logImportEvent("file_selected", {
        details: {
          name: displayName,
          mimeType: asset.mimeType,
          size: asset.size,
        },
      });
      const extension = getSupportedImportExtension(
        displayName ?? asset.uri,
        asset.mimeType,
      );
      const sessionId = Crypto.randomUUID();
      logImportEvent("extension_resolved", {
        sessionId,
        details: { extension, mimeType: asset.mimeType },
      });

      setImportState("copying");
      setStatusLabel("Copying file into app storage...");
      logImportEvent("copy_started", {
        sessionId,
        details: { extension },
      });
      copiedPath = await copyImportedRecordingAsync(
        asset.uri,
        sessionId,
        extension,
      );
      logImportEvent("copy_completed", {
        sessionId,
        details: { extension },
      });

      setImportState("validating");
      setStatusLabel("Checking audio duration...");
      logImportEvent("validation_started", { sessionId });
      const validation = await validateImportedRecordingFileAsync(copiedPath);
      logImportEvent("validation_completed", {
        sessionId,
        details: {
          fileSizeBytes: validation.fileSizeBytes,
        },
      });
      const createdAt = new Date().toISOString();
      const session: RecordingSession = {
        id: sessionId,
        createdAt,
        audioPath: copiedPath,
        durationMs: 0,
        status: "ready",
        fileSizeBytes: validation.fileSizeBytes,
        title: displayName ?? fallbackTitle(createdAt),
        errorMessage: null,
        updatedAt: createdAt,
      };

      await createRecordingSessionAsync(session);
      createdSession = session;
      logImportEvent("session_created", {
        sessionId: session.id,
        details: {
          title: session.title,
          durationMs: session.durationMs,
          fileSizeBytes: session.fileSizeBytes,
        },
      });

      setImportState("processing");
      logImportEvent("model_requested", {
        sessionId: session.id,
        details: { modelState },
      });
      await processRecordingSessionAsync({
        sessionId: session.id,
        getModel,
        onStatus: (status) => {
          if (status === "loading_model") {
            setStatusLabel(
              modelState === "loading"
                ? "Loading model..."
                : "Processing audio...",
            );
          }

          if (status === "model_loaded") {
            logImportEvent("model_loaded", { sessionId: session.id });
          }

          if (status === "preprocessing") {
            setStatusLabel("Preparing audio for inference...");
            logImportEvent("preprocessing_started", { sessionId: session.id });
          }

          if (status === "running_inference") {
            setStatusLabel("Running inference and saving indicators...");
            logImportEvent("inference_started", { sessionId: session.id });
          }

          if (status === "completed") {
            logImportEvent("inference_completed", { sessionId: session.id });
          }
        },
        onInferenceProgress: (chunkIndex, total) => {
          setStatusLabel(`Running inference ${chunkIndex}/${total} chunks...`);
          logImportEvent("inference_progress", {
            sessionId: session.id,
            details: { chunkIndex, total },
          });
        },
      });

      setImportState("completed");
      setStatusLabel("Import processed.");
      logImportEvent("import_completed", { sessionId: session.id });
      showToast({ message: "Imported recording processed.", kind: "success" });
      router.replace(`/results/${session.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";

      if (createdSession) {
        await updateAnalysisJobAsync(createdSession.id, {
          status: "failed",
          errorMessage: message,
        }).catch((jobError) => {
          logImportEvent("analysis_job_failure_update_failed", {
            sessionId: createdSession?.id,
            details: {
              message:
                jobError instanceof Error ? jobError.message : String(jobError),
            },
          });
        });
      }

      if (!createdSession && copiedPath) {
        await deleteRecordingFileAsync(copiedPath)
          .then(() => {
            logImportEvent("cleanup_completed");
          })
          .catch((cleanupError) => {
            logImportEvent("cleanup_failed", {
              details: {
                message:
                  cleanupError instanceof Error
                    ? cleanupError.message
                    : String(cleanupError),
              },
            });
          });
      }

      logImportEvent("import_failed", {
        sessionId: createdSession?.id,
        details: { message },
      });
      setImportState("failed");
      setStatusLabel("Import failed.");
      setErrorMessage(message);
      showToast({ message, kind: "error" });
    }
  }

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    processImport();
  }, []);

  const isBusy =
    importState === "selecting" ||
    importState === "copying" ||
    importState === "validating" ||
    importState === "processing";

  return (
    <View style={[styles.container, { paddingTop: insets.top + 32 }]}>
      <View style={styles.inner}>
        <Pressable
          style={({ pressed }) => [
            styles.backRow,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={18}
            color={colors.white40}
          />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>

        <View style={styles.card}>
          <MaterialCommunityIcons
            name={importState === "failed" ? "alert-circle" : "file-music"}
            size={42}
            color={importState === "failed" ? colors.danger : colors.accent}
          />
          <Text style={styles.title}>Import Recording</Text>
          <Text style={styles.status}>{statusLabel}</Text>
          {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
        </View>

        {isBusy && <Text style={styles.busyText}>This may take a while.</Text>}

        {importState === "failed" && (
          <View style={styles.buttonStack}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={processImport}
            >
              <Text style={styles.primaryButtonText}>Try Another File</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => router.back()}
            >
              <Text style={styles.secondaryButtonText}>Back to Home</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
    paddingHorizontal: 24,
  },
  inner: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  backLabel: {
    fontSize: 13,
    color: colors.white40,
    fontFamily: "monospace",
  },
  card: {
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.white,
    marginTop: 16,
  },
  status: {
    fontSize: 13,
    color: colors.white50,
    fontFamily: "monospace",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 14,
  },
  busyText: {
    fontSize: 12,
    color: colors.white35,
    fontFamily: "monospace",
    textAlign: "center",
    marginTop: 18,
  },
  buttonStack: {
    gap: 12,
    marginTop: 20,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.bgSurface,
  },
  secondaryButton: {
    width: "100%",
    backgroundColor: colors.accentBgSubtle,
    borderWidth: 1,
    borderColor: colors.accentBorderStrong,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.accent,
  },
});
