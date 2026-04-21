import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "@/components/ToastProvider";
import colors from "@/constants/colors";
import type { AnalysisJob, RecordingSession } from "@/constants/types";
import { formatDateTime, formatDurationMs } from "@/constants/helpers";
import { getAnalysisJobForRecordingAsync } from "@/services/analysisDb";
import { listRecordingSessionsAsync } from "@/services/recordingDb";

function logHomeEvent(event: string, details?: Record<string, unknown>) {
  console.log(
    "[home]",
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      details,
    }),
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [analysisJobsBySessionId, setAnalysisJobsBySessionId] = useState<
    Record<string, AnalysisJob | null>
  >({});

  const loadSessions = useCallback(() => {
    let cancelled = false;

    async function run() {
      try {
        logHomeEvent("recording_list_load_started");
        const nextSessions = await listRecordingSessionsAsync();
        const analysisJobs = await Promise.all(
          nextSessions.map(async (session) => [
            session.id,
            await getAnalysisJobForRecordingAsync(session.id),
          ] as const),
        );
        if (!cancelled) {
          setSessions(nextSessions);
          setAnalysisJobsBySessionId(Object.fromEntries(analysisJobs));
          logHomeEvent("recording_list_load_completed", {
            count: nextSessions.length,
            failedAnalysisCount: analysisJobs.filter(
              ([, job]) => job?.status === "failed",
            ).length,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not load recordings.";
        logHomeEvent("recording_list_load_failed", { message });
        showToast({ message, kind: "error" });
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useFocusEffect(loadSessions);

  const readyCount = sessions.filter(
    (session) => session.status === "ready",
  ).length;
  const totalDurationMs = sessions.reduce(
    (total, session) => total + session.durationMs,
    0,
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top },
        ]}
      >
        <View style={styles.hero}>
          <Text style={styles.wordmark}>CADENCE</Text>
          <Text style={styles.greeting}>{"Good morning,\nMr Sachintha."}</Text>
          <Text style={styles.heroMeta}>
            {sessions.length} recordings saved locally
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => router.navigate("/(tabs)/record")}
          >
            <MaterialCommunityIcons
              name="microphone"
              size={18}
              color={colors.bgSurface}
            />
            <Text style={styles.ctaText}>Start New Recording</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.importButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => router.navigate("/import")}
          >
            <MaterialCommunityIcons
              name="file-upload-outline"
              size={18}
              color={colors.accent}
            />
            <Text style={styles.importText}>Import Recording</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Recordings</Text>
            <Pressable
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              onPress={() => router.navigate("/(tabs)/history")}
            >
              <View style={styles.viewAllRow}>
                <Text style={styles.viewAllText}>VIEW ALL</Text>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={11}
                  color={colors.accent}
                />
              </View>
            </Pressable>
          </View>

          <View style={styles.sessionList}>
            {sessions.slice(0, 2).map((session) => {
              const analysisJob = analysisJobsBySessionId[session.id];
              const failedAnalysis = analysisJob?.status === "failed";

              return (
                <Pressable
                  key={session.id}
                  style={({ pressed }) => [
                    styles.recordingCard,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                  onPress={() => router.push(`/results/${session.id}`)}
                >
                  <View style={styles.recordingRow}>
                    <View style={styles.recordingContent}>
                      <Text style={styles.recordingTitle}>
                        {session.title ?? "Recording"}
                      </Text>
                      <Text style={styles.recordingMeta}>
                        {formatDateTime(session.createdAt)} -{" "}
                        {formatDurationMs(session.durationMs)}
                      </Text>
                      {failedAnalysis && (
                        <Text style={styles.recordingFailure}>
                          Processing failed
                        </Text>
                      )}
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={18}
                      color={colors.white20}
                    />
                  </View>
                </Pressable>
              );
            })}

            {sessions.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  Your real recordings will appear here.
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.statsCard}>
          {[
            { label: "Recordings", value: String(sessions.length) },
            { label: "Ready", value: String(readyCount) },
            { label: "Total Time", value: formatDurationMs(totalDurationMs) },
          ].map((stat) => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
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
    paddingBottom: 100,
  },
  hero: {
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.heroBorder,
  },
  wordmark: {
    fontSize: 11,
    color: colors.accent,
    fontFamily: "monospace",
    letterSpacing: 2,
    marginBottom: 8,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.white,
    lineHeight: 32,
  },
  heroMeta: {
    fontSize: 13,
    color: colors.white45,
    fontFamily: "monospace",
    marginTop: 8,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.bgSurface,
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.accentBgSubtle,
    borderWidth: 1,
    borderColor: colors.accentBorderStrong,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  importText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.accent,
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: 0.5,
  },
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {
    fontSize: 12,
    color: colors.accent,
    fontFamily: "monospace",
    letterSpacing: 0.8,
  },
  sessionList: {
    gap: 12,
  },
  recordingCard: {
    padding: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  recordingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  recordingContent: {
    flex: 1,
    marginRight: 8,
  },
  recordingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
    lineHeight: 18,
  },
  recordingMeta: {
    fontSize: 11,
    color: colors.white40,
    fontFamily: "monospace",
    marginTop: 4,
  },
  recordingFailure: {
    fontSize: 11,
    color: colors.danger,
    fontFamily: "monospace",
    marginTop: 6,
  },
  emptyCard: {
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
  },
  emptyText: {
    fontSize: 12,
    color: colors.white40,
    textAlign: "center",
  },
  statsCard: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: 24,
    marginTop: 24,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.accent,
  },
  statLabel: {
    fontSize: 11,
    color: colors.white40,
    fontFamily: "monospace",
    marginTop: 2,
  },
});
