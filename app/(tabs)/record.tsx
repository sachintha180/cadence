import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  createAudioPlayer,
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioPlayer,
} from "expo-audio";
import * as Crypto from "expo-crypto";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useModel } from "@/components/ModelProvider";
import { useToast } from "@/components/ToastProvider";
import colors from "@/constants/colors";
import {
  MAX_RECORDING_DURATION_MS,
  MIN_VALID_RECORDING_MS,
} from "@/constants/recording";
import type {
  AnalysisJob,
  RecorderState,
  RecordingSession,
} from "@/constants/types";
import { formatDateTime, formatDurationMs } from "@/constants/helpers";
import { getAnalysisJobForRecordingAsync } from "@/services/analysisDb";
import { processRecordingSessionAsync } from "@/services/sessionProcessing";
import type { SessionInferenceResult } from "@/src/types/indicators";
import {
  createRecordingSessionAsync,
  updateRecordingSessionAsync,
} from "@/services/recordingDb";
import {
  ensureRecordingsDirectoryAsync,
  getRecordingPath,
  persistRecordingAsync,
  validateRecordingFileAsync,
} from "@/services/recordingFiles";
import { discardRecordingSessionAsync } from "@/services/recordingDelete";
import { logRecorderEvent } from "@/services/recordingLog";

export default function RecordScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { getModel, state: modelState, error: modelError } = useModel();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const audioRecorderState = useAudioRecorderState(audioRecorder, 500);
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activeSession, setActiveSession] = useState<RecordingSession | null>(
    null,
  );
  const [playbackState, setPlaybackState] = useState<
    "idle" | "playing" | "paused"
  >("idle");
  const [analysisJob, setAnalysisJob] = useState<AnalysisJob | null>(null);
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("Processing audio...");
  const [inferenceResult, setInferenceResult] =
    useState<SessionInferenceResult | null>(null);

  const playerRef = useRef<AudioPlayer | null>(null);
  const playbackPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<RecorderState>("idle");
  const stoppingRef = useRef(false);
  const activeSessionRef = useRef<RecordingSession | null>(null);

  useEffect(() => {
    stateRef.current = recorderState;
  }, [recorderState]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const stopPlayback = useCallback(async () => {
    if (playbackPollRef.current) {
      clearInterval(playbackPollRef.current);
      playbackPollRef.current = null;
    }

    if (playerRef.current) {
      playerRef.current.remove();
      playerRef.current = null;
    }
    setPlaybackState("idle");
  }, []);

  function startPlaybackPolling() {
    if (playbackPollRef.current) {
      clearInterval(playbackPollRef.current);
    }

    playbackPollRef.current = setInterval(() => {
      const player = playerRef.current;

      if (!player) {
        return;
      }

      if (player.currentStatus.didJustFinish) {
        stopPlayback();
      }
    }, 500);
  }

  async function discardAfterFailure(
    session: RecordingSession,
    audioPath?: string | null,
  ) {
    try {
      await discardRecordingSessionAsync(
        session,
        audioPath ?? session.audioPath,
      );
    } catch (error) {
      logRecorderEvent("recording_failed", {
        sessionId: session.id,
        details: {
          cleanupError: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  async function loadAnalysisJob(sessionId: string) {
    try {
      const job = await getAnalysisJobForRecordingAsync(sessionId);
      setAnalysisJob(job);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not load preprocessing status.";
      showToast({ message, kind: "error" });
    }
  }

  const finishRecording = useCallback(
    async (autoStopped = false) => {
      const session = activeSession;

      if (!session || stoppingRef.current) {
        return;
      }

      stoppingRef.current = true;
      setRecorderState("stopping");

      try {
        const status = audioRecorder.getStatus();
        const durationMs = status.durationMillis ?? elapsedMs;

        await audioRecorder.stop();

        const sourceUri = audioRecorder.uri;

        if (!sourceUri) {
          throw new Error("Recording did not return a file URI.");
        }

        logRecorderEvent(
          autoStopped ? "recording_auto_stopped" : "recording_stopped",
          { sessionId: session.id, details: { durationMs } },
        );

        setRecorderState("validating");
        let audioPath: string | null = null;

        try {
          audioPath = await persistRecordingAsync(sourceUri, session.id);
          await updateRecordingSessionAsync(session.id, {
            audioPath,
            durationMs,
            status: "stopped",
          });
          const validation = await validateRecordingFileAsync(
            audioPath,
            durationMs,
          );

          const readySession: RecordingSession = {
            ...session,
            audioPath,
            durationMs,
            status: "ready",
            fileSizeBytes: validation.fileSizeBytes,
            errorMessage: null,
            updatedAt: new Date().toISOString(),
          };

          await updateRecordingSessionAsync(session.id, {
            audioPath,
            durationMs,
            status: "ready",
            fileSizeBytes: validation.fileSizeBytes,
            errorMessage: null,
          });

          logRecorderEvent("recording_validated", {
            sessionId: session.id,
            details: { durationMs, fileSizeBytes: validation.fileSizeBytes },
          });

          setActiveSession(readySession);
          setAnalysisJob(null);
          setInferenceResult(null);
          setElapsedMs(durationMs);
          setRecorderState("ready");
          showToast({
            message: autoStopped
              ? "Recording stopped at 90 minutes."
              : "Recording saved.",
            kind: "success",
          });
        } catch (error) {
          await discardAfterFailure(session, audioPath);
          throw error;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Recording failed.";

        if (session) {
          await discardAfterFailure(session);
          logRecorderEvent("recording_failed", {
            sessionId: session.id,
            details: { message },
          });
        }

        setActiveSession(null);
        setRecorderState("failed");
        showToast({ message, kind: "error" });
      } finally {
        stoppingRef.current = false;
      }
    },
    [activeSession, audioRecorder, elapsedMs, showToast],
  );

  const pauseRecording = useCallback(
    async (fromInterruption = false) => {
      if (stateRef.current !== "recording") {
        return;
      }

      try {
        audioRecorder.pause();
        const status = audioRecorder.getStatus();
        setElapsedMs(status.durationMillis ?? elapsedMs);
        setRecorderState("paused");
        logRecorderEvent("recording_paused", {
          sessionId: activeSession?.id,
          details: { fromInterruption },
        });

        if (fromInterruption) {
          showToast({ message: "Recording paused.", kind: "info" });
        }
      } catch (error) {
        logRecorderEvent("interruption_pause_failed_saved", {
          sessionId: activeSession?.id,
          details: {
            message: error instanceof Error ? error.message : String(error),
          },
        });
        await finishRecording(false);
      }
    },
    [activeSession?.id, audioRecorder, elapsedMs, finishRecording, showToast],
  );

  useEffect(() => {
    if (recorderState === "recording" || recorderState === "paused") {
      const durationMs = audioRecorderState.durationMillis ?? 0;
      setElapsedMs(durationMs);

      if (
        durationMs >= MAX_RECORDING_DURATION_MS &&
        stateRef.current === "recording"
      ) {
        finishRecording(true);
      }
    }
  }, [audioRecorderState.durationMillis, finishRecording, recorderState]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" && stateRef.current === "recording") {
        pauseRecording(true);
      }
    });

    return () => subscription.remove();
  }, [pauseRecording]);

  useEffect(() => {
    return () => {
      audioRecorder.stop().catch(() => undefined);
      playerRef.current?.remove();
    };
  }, [audioRecorder]);

  async function requestRecordingPermission() {
    setRecorderState("requesting_permission");
    logRecorderEvent("permission_requested");

    const current = await getRecordingPermissionsAsync();
    const permission = current.granted
      ? current
      : await requestRecordingPermissionsAsync();

    if (permission.granted) {
      logRecorderEvent("permission_granted");
      return true;
    }

    logRecorderEvent("permission_denied", {
      details: { canAskAgain: permission.canAskAgain },
    });

    showToast({
      message: permission.canAskAgain
        ? "Microphone permission is required to record."
        : "Microphone permission is disabled. Open settings to enable it.",
      kind: "error",
      actionLabel: permission.canAskAgain ? undefined : "Open Settings",
      onAction: permission.canAskAgain
        ? undefined
        : () => Linking.openSettings(),
    });

    setRecorderState("idle");
    return false;
  }

  async function beginRecording() {
    let createdSession: RecordingSession | null = null;

    try {
      await stopPlayback();
      const hasPermission = await requestRecordingPermission();

      if (!hasPermission) {
        return;
      }

      setRecorderState("preparing");
      setAnalysisJob(null);
      setInferenceResult(null);
      await ensureRecordingsDirectoryAsync();
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
        allowsBackgroundRecording: false,
      });

      const id = Crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const title = `Recording - ${formatDateTime(createdAt)}`;
      const session: RecordingSession = {
        id,
        createdAt,
        audioPath: getRecordingPath(id),
        durationMs: 0,
        status: "recording",
        fileSizeBytes: null,
        title,
        errorMessage: null,
        updatedAt: createdAt,
      };

      await createRecordingSessionAsync(session);
      createdSession = session;

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      setActiveSession(session);
      setInferenceResult(null);
      setElapsedMs(0);
      setRecorderState("recording");
      logRecorderEvent("recording_started", { sessionId: id });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start recording.";
      const session = activeSessionRef.current ?? createdSession;

      if (session) {
        await discardAfterFailure(session);
        setActiveSession(null);
      }

      setRecorderState("failed");
      showToast({ message, kind: "error" });
      logRecorderEvent("recording_failed", { details: { message } });
    }
  }

  async function resumeRecording() {
    if (recorderState !== "paused") {
      return;
    }

    try {
      audioRecorder.record();
      setRecorderState("recording");
      logRecorderEvent("recording_resumed", { sessionId: activeSession?.id });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not resume recording.";
      showToast({ message, kind: "error" });
      logRecorderEvent("recording_failed", {
        sessionId: activeSession?.id,
        details: { message },
      });
    }
  }

  async function togglePlayback() {
    if (!activeSession || recorderState !== "ready" || isPreprocessing) {
      return;
    }

    try {
      if (playbackState === "playing" && playerRef.current) {
        playerRef.current.pause();
        setPlaybackState("paused");
        return;
      }

      if (playbackState === "paused" && playerRef.current) {
        playerRef.current.play();
        setPlaybackState("playing");
        startPlaybackPolling();
        return;
      }

      const player = createAudioPlayer({ uri: activeSession.audioPath });
      player.play();

      playerRef.current = player;
      setPlaybackState("playing");
      startPlaybackPolling();
      logRecorderEvent("playback_started", { sessionId: activeSession.id });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not play recording.";
      showToast({ message, kind: "error" });
      logRecorderEvent("playback_failed", {
        sessionId: activeSession.id,
        details: { message },
      });
    }
  }

  async function processRecording() {
    if (!activeSession || recorderState !== "ready" || isPreprocessing) {
      return;
    }

    try {
      await stopPlayback();
      setIsPreprocessing(true);
      setInferenceResult(null);
      const nextInferenceResult = await processRecordingSessionAsync({
        sessionId: activeSession.id,
        getModel,
        onStatus: (status) => {
          if (status === "loading_model") {
            setProcessingLabel(
              modelState === "loading"
                ? "Loading model..."
                : "Processing audio...",
            );
          }

          if (status === "preprocessing") {
            setProcessingLabel("Processing audio...");
          }

          if (status === "running_inference") {
            setProcessingLabel("Running inference...");
          }
        },
      });
      setInferenceResult(nextInferenceResult);
      await loadAnalysisJob(activeSession.id);

      console.log(
        `[Cadence] Session inference complete: ${nextInferenceResult.totalChunks} chunks, ${nextInferenceResult.totalInferenceTimeMs}ms total, ${nextInferenceResult.averageChunkTimeMs}ms avg per chunk`,
      );

      await updateRecordingSessionAsync(activeSession.id, {
        status: "completed",
        errorMessage: null,
      });

      const completedSession: RecordingSession = {
        ...activeSession,
        status: "completed",
        errorMessage: null,
        updatedAt: new Date().toISOString(),
      };

      setActiveSession(completedSession);
      showToast({ message: "Recording processed.", kind: "success" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Processing failed.";
      await loadAnalysisJob(activeSession.id);
      showToast({ message, kind: "error" });
    } finally {
      setIsPreprocessing(false);
      setProcessingLabel("Processing audio...");
    }
  }

  const canStart =
    !isPreprocessing &&
    (recorderState === "idle" ||
      recorderState === "failed" ||
      activeSession?.status === "completed");
  const isBusy =
    isPreprocessing ||
    recorderState === "requesting_permission" ||
    recorderState === "preparing" ||
    recorderState === "stopping" ||
    recorderState === "validating";

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 32 },
        ]}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>New Recording</Text>
          <Text style={styles.subtitle}>
            Position your device to capture the classroom
          </Text>

          <View
            style={[
              styles.card,
              recorderState === "recording" && styles.cardAccentBorder,
            ]}
          >
            <MaterialCommunityIcons
              name="waveform"
              size={48}
              color={
                recorderState === "recording" ? colors.accent : colors.white15
              }
            />
            <Text
              style={[
                styles.timer,
                recorderState === "recording" && styles.timerActive,
              ]}
            >
              {formatDurationMs(elapsedMs)}
            </Text>
            <Text style={styles.stateLabel}>{recorderState.toUpperCase()}</Text>
          </View>

          {recorderState === "recording" && (
            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={() => pauseRecording(false)}
              >
                <Text style={styles.secondaryButtonText}>Pause</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.dangerButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={() => finishRecording(false)}
              >
                <Text style={styles.dangerButtonText}>Stop</Text>
              </Pressable>
            </View>
          )}

          {recorderState === "paused" && (
            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.buttonHalf,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={resumeRecording}
              >
                <Text style={styles.primaryButtonText}>Resume</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.dangerButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={() => finishRecording(false)}
              >
                <Text style={styles.dangerButtonText}>Stop</Text>
              </Pressable>
            </View>
          )}

          {canStart && (
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={beginRecording}
            >
              <Text style={styles.primaryButtonText}>Begin Recording</Text>
            </Pressable>
          )}

          {isBusy && (
            <Text style={styles.processLabel}>
              {isPreprocessing
                ? processingLabel
                : recorderState === "validating"
                  ? "Checking recording..."
                  : "Preparing recorder..."}
            </Text>
          )}

          {recorderState === "ready" && activeSession && (
            <View style={styles.playbackCard}>
              <Text style={styles.playbackTitle}>Recording ready</Text>
              <Text style={styles.playbackMeta}>
                {formatDurationMs(activeSession.durationMs)} -{" "}
                {Math.round((activeSession.fileSizeBytes ?? 0) / 1024)} KB
                {activeSession.status === "completed" ? " - COMPLETED" : ""}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    opacity: isPreprocessing ? 0.45 : pressed ? 0.85 : 1,
                  },
                ]}
                disabled={isPreprocessing}
                onPress={togglePlayback}
              >
                <Text style={styles.secondaryButtonText}>
                  {playbackState === "playing"
                    ? "Pause Recording"
                    : playbackState === "paused"
                      ? "Resume Recording"
                      : "Play Recording"}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.processingButton,
                  {
                    opacity: isPreprocessing ? 0.45 : pressed ? 0.85 : 1,
                  },
                ]}
                disabled={isPreprocessing}
                onPress={processRecording}
              >
                <Text style={styles.primaryButtonText}>
                  {analysisJob?.status === "failed"
                    ? "Retry Processing"
                    : activeSession.status === "completed"
                      ? "Run Again"
                      : analysisJob?.status === "preprocessed"
                        ? "Process Again"
                        : "Process Recording"}
                </Text>
              </Pressable>
              {analysisJob && (
                <View style={styles.analysisMeta}>
                  <Text style={styles.analysisStatus}>
                    {analysisJob.status.toUpperCase()}
                  </Text>
                  {analysisJob.status === "preprocessed" && (
                    <Text style={styles.analysisText}>
                      {analysisJob.processedSampleRate} Hz mono -{" "}
                      {Math.round(
                        (analysisJob.processedFileSizeBytes ?? 0) / 1024,
                      )}{" "}
                      KB
                    </Text>
                  )}
                  {inferenceResult && (
                    <Text style={styles.analysisText}>
                      {inferenceResult.totalChunks} chunks -{" "}
                      {Math.round(inferenceResult.averageChunkTimeMs)} ms avg
                    </Text>
                  )}
                  {analysisJob.status === "failed" && (
                    <Text style={styles.analysisError}>
                      {analysisJob.errorMessage}
                    </Text>
                  )}
                  {modelState === "error" && modelError && (
                    <Text style={styles.analysisError}>
                      Model load failed: {modelError.message}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          <Text style={styles.limitText}>
            Minimum {Math.floor(MIN_VALID_RECORDING_MS / 1000)} seconds. Maximum
            90 minutes.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 100,
    alignItems: "center",
  },
  inner: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.white,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.white40,
    fontFamily: "monospace",
    textAlign: "center",
    marginBottom: 24,
  },
  card: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  cardAccentBorder: {
    borderColor: colors.accentBorderStrong,
  },
  timer: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.white20,
    fontFamily: "monospace",
    marginTop: 16,
    textAlign: "center",
  },
  timerActive: {
    color: colors.accent,
  },
  stateLabel: {
    fontSize: 11,
    color: colors.white40,
    fontFamily: "monospace",
    marginTop: 8,
  },
  buttonRow: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonHalf: {
    flex: 1,
    width: "auto",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.bgSurface,
  },
  secondaryButton: {
    flex: 1,
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
  dangerButton: {
    flex: 1,
    backgroundColor: colors.dangerBgAlt,
    borderWidth: 1,
    borderColor: colors.dangerBorderStrong,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.danger,
  },
  processLabel: {
    fontSize: 12,
    color: colors.white50,
    fontFamily: "monospace",
    textAlign: "center",
    marginTop: 16,
  },
  playbackCard: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
    marginTop: 18,
  },
  playbackTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
  playbackMeta: {
    fontSize: 12,
    color: colors.white40,
    fontFamily: "monospace",
    marginTop: 4,
    marginBottom: 14,
  },
  processingButton: {
    marginTop: 12,
  },
  analysisMeta: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    marginTop: 14,
    paddingTop: 14,
  },
  analysisStatus: {
    fontSize: 11,
    color: colors.accent,
    fontFamily: "monospace",
    marginBottom: 6,
  },
  analysisText: {
    fontSize: 12,
    color: colors.white45,
    fontFamily: "monospace",
  },
  analysisError: {
    fontSize: 12,
    color: colors.danger,
    lineHeight: 18,
  },
  limitText: {
    fontSize: 11,
    color: colors.white35,
    fontFamily: "monospace",
    textAlign: "center",
    marginTop: 20,
  },
});
