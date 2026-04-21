import React, { useEffect, useMemo, useState } from "react";
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

import { useToast } from "@/components/ToastProvider";
import colors from "@/constants/colors";
import type { RecordingSession } from "@/constants/types";
import { formatDateTime, formatDurationMs } from "@/constants/helpers";
import {
  getIndicatorRowsForSession,
  type ChunkIndicatorRow,
  type SessionIndicatorRow,
} from "@/src/db/indicatorRepository";
import { getRecordingSessionAsync } from "@/services/recordingDb";

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
  sessionIndicators: SessionIndicatorRow | null;
  chunkIndicators: ChunkIndicatorRow[];
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatSeconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatMetric(value: number) {
  return value.toFixed(4);
}

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<ResultsState>({
    session: null,
    sessionIndicators: null,
    chunkIndicators: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        setLoading(true);
        logResultsEvent("results_load_started", { sessionId: id });
        const nextSession = id ? await getRecordingSessionAsync(id) : null;
        const indicatorRows = id
          ? await getIndicatorRowsForSession(id)
          : { sessionIndicators: null, chunkIndicators: [] };

        if (!cancelled) {
          setState({
            session: nextSession,
            sessionIndicators: indicatorRows.sessionIndicators,
            chunkIndicators: indicatorRows.chunkIndicators,
          });
          logResultsEvent("results_load_completed", {
            sessionId: id,
            recordingFound: Boolean(nextSession),
            hasSessionIndicators: Boolean(indicatorRows.sessionIndicators),
            chunkCount: indicatorRows.chunkIndicators.length,
            renderMode: indicatorRows.sessionIndicators
              ? "analysed"
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

  const { session, sessionIndicators, chunkIndicators } = state;
  const analysed = Boolean(sessionIndicators);

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
                <Text style={styles.sectionEyebrow}>Session Summary</Text>
                <Text style={styles.cardTitle}>Analysis Results</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  analysed ? styles.analysedBadge : styles.pendingBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    analysed
                      ? styles.analysedBadgeText
                      : styles.pendingBadgeText,
                  ]}
                >
                  {analysed ? "Analysed" : "Not yet analysed"}
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

          {!sessionIndicators && (
            <View style={styles.card}>
              <MaterialCommunityIcons
                name="chart-timeline-variant"
                size={32}
                color={colors.white30}
              />
              <Text style={styles.cardTitle}>Analysis not run yet</Text>
              <Text style={styles.cardBody}>
                This recording is saved locally. Process it from the Record
                screen to generate speech activity, energy, and pause metrics.
              </Text>
            </View>
          )}

          {sessionIndicators && (
            <>
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
                <View style={styles.energyChart}>
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
              </View>
            </>
          )}

          <View style={[styles.card, styles.disabledCard]}>
            <Text style={styles.sectionEyebrow}>Pitch Variation</Text>
            <Text style={styles.disabledTitle}>Coming in next update</Text>
            <Text style={styles.cardBody}>
              Embedding-derived pitch variation is planned for the next
              indicator phase.
            </Text>
          </View>
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
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    marginTop: 18,
    paddingTop: 14,
  },
  energyBarSlot: {
    flex: 1,
    minWidth: 3,
    justifyContent: "flex-end",
  },
  energyBar: {
    width: "100%",
    minHeight: 8,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
});
