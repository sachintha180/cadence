import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useModel } from "@/components/ModelProvider";
import { useToast } from "@/components/ToastProvider";
import colors from "@/constants/colors";
import type { AnalysisJob, RecordingSession } from "@/constants/types";
import { formatDateTime, formatDurationMs } from "@/constants/helpers";
import { getAnalysisJobForRecordingAsync } from "@/services/analysisDb";
import {
  getIndicatorRowsForSession,
  type ChunkIndicatorRow,
  type SessionIndicatorRow,
} from "@/src/db/indicatorRepository";
import {
  generateSessionSummary,
  interpretEnergyConsistency,
  interpretPauseFrequency,
  interpretProsody,
  interpretSpeechActivity,
} from "@/src/utils/indicatorInterpreter";
import { getRecordingSessionAsync } from "@/services/recordingDb";
import {
  processRecordingSessionAsync,
  type ProcessingStatus,
} from "@/services/sessionProcessing";

function logResultsEvent(event: string, details?: Record<string, unknown>) {
  console.log(
    "[results]",
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      details,
    }),
  );
}

type ResultsState = {
  session: RecordingSession | null;
  analysisJob: AnalysisJob | null;
  sessionIndicators: SessionIndicatorRow | null;
  chunkIndicators: ChunkIndicatorRow[];
};

const INDICATOR_DISCLAIMER =
  "Indicators are derived from acoustic signal analysis. Speech activity and pause detection use amplitude-based voice activity detection. Prosody proxy is derived from Wav2Vec2 embedding dispersion and does not represent true pitch in Hz. Thresholds are calibrated on a single-teacher corpus and may vary across speakers and environments.";

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatSeconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatMetric(value: number) {
  return value.toFixed(4);
}

type ProcessActionProps = {
  disabled: boolean;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
};

function ProcessAction({
  disabled,
  label,
  accessibilityLabel,
  onPress,
}: ProcessActionProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.processButton,
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    >
      <MaterialCommunityIcons
        name="play-circle-outline"
        size={18}
        color={colors.bgSurface}
      />
      <Text style={styles.processButtonText}>{label}</Text>
    </Pressable>
  );
}

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { getModel } = useModel();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<ResultsState>({
    session: null,
    analysisJob: null,
    sessionIndicators: null,
    chunkIndicators: [],
  });
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("Processing audio...");

  const loadResults = useCallback(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        setLoading(true);
        logResultsEvent("results_load_started", { sessionId: id });
        const nextSession = id ? await getRecordingSessionAsync(id) : null;
        const analysisJob = id
          ? await getAnalysisJobForRecordingAsync(id)
          : null;
        const indicatorRows = id
          ? await getIndicatorRowsForSession(id)
          : { sessionIndicators: null, chunkIndicators: [] };

        if (!cancelled) {
          setState({
            session: nextSession,
            analysisJob,
            sessionIndicators: indicatorRows.sessionIndicators,
            chunkIndicators: indicatorRows.chunkIndicators,
          });
          logResultsEvent("results_load_completed", {
            sessionId: id,
            recordingFound: Boolean(nextSession),
            hasSessionIndicators: Boolean(indicatorRows.sessionIndicators),
            analysisJobStatus: analysisJob?.status ?? null,
            chunkCount: indicatorRows.chunkIndicators.length,
            renderMode: indicatorRows.sessionIndicators
              ? "analysed"
              : analysisJob?.status === "failed"
                ? "processing_failed"
                : "not_analysed",
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not load results.";
        logResultsEvent("results_load_failed", { sessionId: id, message });
        showToast({ message, kind: "error" });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [id, showToast]);

  useEffect(loadResults, [loadResults]);

  function labelForProcessingStatus(status: ProcessingStatus) {
    switch (status) {
      case "loading_model":
        return "Loading model...";
      case "model_loaded":
        return "Preparing audio...";
      case "preprocessing":
        return "Preparing audio...";
      case "running_inference":
        return "Running inference...";
      case "completed":
        return "Processing complete.";
      default:
        return "Processing audio...";
    }
  }

  async function processFromResults() {
    const session = state.session;

    if (!session || isProcessing || state.sessionIndicators) {
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingLabel("Processing audio...");
      logResultsEvent("results_processing_started", {
        sessionId: session.id,
        previousAnalysisJobStatus: state.analysisJob?.status ?? null,
      });

      const result = await processRecordingSessionAsync({
        sessionId: session.id,
        getModel,
        onStatus: (status) => {
          const label = labelForProcessingStatus(status);
          setProcessingLabel(label);
          logResultsEvent("results_processing_status", {
            sessionId: session.id,
            status,
          });
        },
        onInferenceProgress: (chunkIndex, total) => {
          setProcessingLabel(
            `Running inference ${chunkIndex}/${total} chunks...`,
          );
          logResultsEvent("results_processing_progress", {
            sessionId: session.id,
            chunkIndex,
            total,
          });
        },
      });

      logResultsEvent("results_processing_completed", {
        sessionId: session.id,
        totalChunks: result.totalChunks,
        totalInferenceTimeMs: result.totalInferenceTimeMs,
      });
      showToast({ message: "Recording processed.", kind: "success" });
      loadResults();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Processing failed.";
      logResultsEvent("results_processing_failed", {
        sessionId: session.id,
        message,
      });
      showToast({ message, kind: "error" });
      loadResults();
    } finally {
      setIsProcessing(false);
      setProcessingLabel("Processing audio...");
    }
  }

  const maxChunkRms = useMemo(() => {
    return Math.max(0, ...state.chunkIndicators.map((chunk) => chunk.mean_rms));
  }, [state.chunkIndicators]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.mutedText}>Loading results...</Text>
      </View>
    );
  }

  if (!state.session) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.mutedText}>Recording not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const { session, analysisJob, sessionIndicators, chunkIndicators } = state;
  const analysed = Boolean(sessionIndicators);
  const processingFailed = !analysed && analysisJob?.status === "failed";
  const canProcess = !analysed && !isProcessing;
  const processButtonLabel = processingFailed
    ? "Retry Processing"
    : "Process Recording";
  const pitchEmbeddingStd = sessionIndicators?.pitch_embedding_std_mean ?? null;
  const sessionSummary = sessionIndicators
    ? generateSessionSummary({
        speechRatio: sessionIndicators.session_speech_ratio,
        stdRms: sessionIndicators.mean_rms_std,
        meanPausesPerChunk: sessionIndicators.mean_pauses_per_chunk,
        embeddingStd: pitchEmbeddingStd,
      })
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
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
          <Text style={styles.headerMeta}>
            {formatDateTime(session.createdAt)} -{" "}
            {formatDurationMs(session.durationMs)}
          </Text>
          <Text style={styles.headerTitle}>{session.title ?? "Recording"}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.sectionEyebrow}>Analysis Status</Text>
                <Text style={styles.cardTitle}>Analysis Results</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  isProcessing
                    ? styles.processingBadge
                    : analysed
                      ? styles.analysedBadge
                      : processingFailed
                        ? styles.failedBadge
                        : styles.pendingBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isProcessing
                      ? styles.processingBadgeText
                      : analysed
                        ? styles.analysedBadgeText
                        : processingFailed
                          ? styles.failedBadgeText
                          : styles.pendingBadgeText,
                  ]}
                >
                  {isProcessing
                    ? "Processing"
                    : analysed
                      ? "Analysed"
                      : processingFailed
                        ? "Processing failed"
                        : "Not yet analysed"}
                </Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>DURATION</Text>
              <Text style={styles.metaValue}>
                {formatDurationMs(session.durationMs)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>STATUS</Text>
              <Text style={styles.metaValue}>
                {session.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {!sessionIndicators && processingFailed && (
            <View style={styles.card}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={32}
                color={colors.danger}
              />
              <Text style={styles.cardTitle}>Processing failed</Text>
              <Text style={styles.cardBody}>
                The recording is still saved locally and ready to process again.{" "}
                {analysisJob.errorMessage ?? "No error detail was saved."}
              </Text>
              <ProcessAction
                disabled={!canProcess}
                label={isProcessing ? processingLabel : processButtonLabel}
                accessibilityLabel={processButtonLabel}
                onPress={processFromResults}
              />
            </View>
          )}

          {!sessionIndicators && !processingFailed && (
            <View style={styles.card}>
              <MaterialCommunityIcons
                name="chart-timeline-variant"
                size={32}
                color={colors.white30}
              />
              <Text style={styles.cardTitle}>Analysis not run yet</Text>
              <Text style={styles.cardBody}>
                This recording is saved locally. Process it here to generate
                speech activity, energy, and pause metrics.
              </Text>
              <ProcessAction
                disabled={!canProcess}
                label={isProcessing ? processingLabel : processButtonLabel}
                accessibilityLabel={processButtonLabel}
                onPress={processFromResults}
              />
            </View>
          )}

          {sessionIndicators && (
            <>
              <View style={[styles.card, styles.summaryCard]}>
                <Text style={styles.sectionEyebrow}>Session Summary</Text>
                <Text style={styles.summaryText}>{sessionSummary}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionEyebrow}>Speech Activity</Text>
                <Text style={styles.bigMetric}>
                  {formatPercent(sessionIndicators.session_speech_ratio)}
                </Text>
                <Text style={styles.metricLabel}>Teacher talk time</Text>
                <View style={styles.horizontalBarTrack}>
                  <View
                    style={[
                      styles.horizontalBarFill,
                      {
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            sessionIndicators.session_speech_ratio * 100,
                          ),
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.interpretationText}>
                  {interpretSpeechActivity(
                    sessionIndicators.session_speech_ratio,
                  )}
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionEyebrow}>Energy Consistency</Text>
                <View style={styles.metricGrid}>
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricValue}>
                      {formatMetric(sessionIndicators.mean_rms_mean)}
                    </Text>
                    <Text style={styles.metricLabel}>Mean RMS</Text>
                  </View>
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricValue}>
                      {formatMetric(sessionIndicators.mean_rms_std)}
                    </Text>
                    <Text style={styles.metricLabel}>
                      Consistency (lower = more consistent)
                    </Text>
                  </View>
                </View>
                <Text style={styles.interpretationText}>
                  {interpretEnergyConsistency(sessionIndicators.mean_rms_std)}
                </Text>
                <View style={styles.energyChart}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.energyChartContent}
                  >
                    {chunkIndicators.map((chunk) => {
                      const height =
                        maxChunkRms > 0
                          ? Math.max(8, (chunk.mean_rms / maxChunkRms) * 86)
                          : 8;
                      return (
                        <View
                          key={`${chunk.session_id}-${chunk.chunk_index}`}
                          style={styles.energyBarSlot}
                        >
                          <View style={[styles.energyBar, { height }]} />
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionEyebrow}>Pauses</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>TOTAL PAUSES DETECTED</Text>
                  <Text style={styles.metaValue}>
                    {sessionIndicators.total_pause_count}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>TOTAL PAUSE TIME</Text>
                  <Text style={styles.metaValue}>
                    {formatSeconds(sessionIndicators.total_pause_duration_ms)}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>LONGEST PAUSE</Text>
                  <Text style={styles.metaValue}>
                    {formatSeconds(sessionIndicators.longest_pause_ms)}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>AVG PAUSES PER 10S CHUNK</Text>
                  <Text style={styles.metaValue}>
                    {sessionIndicators.mean_pauses_per_chunk.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.interpretationText}>
                  {interpretPauseFrequency(
                    sessionIndicators.mean_pauses_per_chunk,
                  )}
                </Text>
              </View>
            </>
          )}

          {sessionIndicators && (
            <>
              {pitchEmbeddingStd !== null ? (
                <View style={styles.card}>
                  <Text style={styles.sectionEyebrow}>Pitch Variation</Text>
                  <View style={styles.metricGrid}>
                    <View style={styles.metricBlock}>
                      <Text style={styles.metricValue}>
                        {formatMetric(pitchEmbeddingStd)}
                      </Text>
                      <Text style={styles.metricLabel}>Embedding std</Text>
                    </View>
                    <View style={styles.metricBlock}>
                      <Text style={styles.metricValue}>
                        {sessionIndicators.pitch_embedding_std_std === null
                          ? "N/A"
                          : formatMetric(
                              sessionIndicators.pitch_embedding_std_std,
                            )}
                      </Text>
                      <Text style={styles.metricLabel}>
                        Between-chunk std (lower = more consistent)
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.interpretationText}>
                    {interpretProsody(pitchEmbeddingStd)}
                  </Text>
                  <Text style={styles.cardBody}>
                    Derived from Wav2Vec2 embedding standard deviation. Higher
                    values indicate more varied vocal delivery.
                  </Text>
                </View>
              ) : (
                <View style={[styles.card, styles.disabledCard]}>
                  <Text style={styles.sectionEyebrow}>Pitch Variation</Text>
                  <Text style={styles.disabledTitle}>
                    Coming in next update
                  </Text>
                  <Text style={styles.cardBody}>
                    Embedding-derived pitch variation is planned for the next
                    indicator phase.
                  </Text>
                </View>
              )}

              <Text style={styles.disclaimerText}>{INDICATOR_DISCLAIMER}</Text>
            </>
          )}
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
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  mutedText: {
    fontSize: 16,
    color: colors.white40,
    fontFamily: "monospace",
    textAlign: "center",
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: colors.accent,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.bgSurface,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.heroBorder,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  backLabel: {
    fontSize: 13,
    color: colors.white40,
    fontFamily: "monospace",
  },
  headerMeta: {
    fontSize: 11,
    color: colors.white40,
    fontFamily: "monospace",
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.white,
    lineHeight: 26,
  },
  content: {
    padding: 24,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
  },
  disabledCard: {
    opacity: 0.72,
  },
  summaryCard: {
    backgroundColor: colors.accentBgSubtle,
    borderColor: colors.accentBorder,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionEyebrow: {
    fontSize: 11,
    color: colors.white40,
    fontFamily: "monospace",
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.white,
  },
  disabledTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.white50,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.white50,
    marginTop: 8,
  },
  summaryText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.white,
  },
  interpretationText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.white82,
    marginTop: 14,
  },
  disclaimerText: {
    fontSize: 11,
    lineHeight: 17,
    color: colors.white40,
    paddingHorizontal: 4,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  analysedBadge: {
    backgroundColor: colors.statusGoodBg,
    borderColor: colors.statusGood,
  },
  pendingBadge: {
    backgroundColor: colors.statusNeutralBg,
    borderColor: colors.white20,
  },
  processingBadge: {
    backgroundColor: colors.accentBgSubtle,
    borderColor: colors.accentBorderStrong,
  },
  failedBadge: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: "700",
  },
  analysedBadgeText: {
    color: colors.statusGood,
  },
  pendingBadgeText: {
    color: colors.statusNeutral,
  },
  processingBadgeText: {
    color: colors.accent,
  },
  failedBadgeText: {
    color: colors.danger,
  },
  processButton: {
    width: "100%",
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 18,
  },
  processButtonText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.bgSurface,
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 12,
    marginTop: 12,
  },
  metaLabel: {
    flex: 1,
    fontSize: 11,
    color: colors.white40,
    fontFamily: "monospace",
  },
  metaValue: {
    flexShrink: 0,
    fontSize: 11,
    color: colors.accent,
    fontFamily: "monospace",
    textAlign: "right",
  },
  bigMetric: {
    fontSize: 38,
    fontWeight: "700",
    color: colors.white,
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.white45,
    marginTop: 4,
  },
  horizontalBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.white08,
    overflow: "hidden",
    marginTop: 18,
  },
  horizontalBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.statusGood,
  },
  metricGrid: {
    flexDirection: "row",
    gap: 12,
  },
  metricBlock: {
    flex: 1,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.white,
    fontFamily: "monospace",
  },
  energyChart: {
    height: 110,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    marginTop: 18,
    paddingTop: 14,
    overflow: "hidden",
  },
  energyChartContent: {
    minWidth: "100%",
    alignItems: "flex-end",
    gap: 3,
  },
  energyBarSlot: {
    width: 4,
    height: 86,
    justifyContent: "flex-end",
  },
  energyBar: {
    width: "100%",
    minHeight: 8,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
});
