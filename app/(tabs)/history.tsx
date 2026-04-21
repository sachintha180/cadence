import React, { useCallback, useState } from "react";
import {
  Alert,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Pill from "@/components/Pill";
import { useToast } from "@/components/ToastProvider";
import colors from "@/constants/colors";
import type { RecordingSession } from "@/constants/types";
import { formatDateTime, formatDurationMs } from "@/constants/helpers";
import { listRecordingSessionsAsync } from "@/services/recordingDb";
import { deleteRecordingAsync } from "@/services/recordingDelete";

function logHistoryEvent(event: string, details?: Record<string, unknown>) {
  console.log(
    "[history]",
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      details,
    }),
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        logHistoryEvent("recording_list_load_started");
        const nextSessions = await listRecordingSessionsAsync();
        if (!cancelled) {
          setSessions(nextSessions);
          logHistoryEvent("recording_list_load_completed", {
            count: nextSessions.length,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not load recordings.";
        logHistoryEvent("recording_list_load_failed", { message });
        showToast({ message, kind: "error" });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useFocusEffect(loadSessions);

  const total = sessions.length;

  function confirmDeleteRecording(session: RecordingSession) {
    logHistoryEvent("recording_delete_confirm_opened", {
      sessionId: session.id,
    });
    Alert.alert(
      "Delete recording?",
      "This will permanently remove the audio file from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            logHistoryEvent("recording_delete_confirmed", {
              sessionId: session.id,
            });
            deleteRecording(session);
          },
        },
      ],
    );
  }

  async function deleteRecording(session: RecordingSession) {
    try {
      await deleteRecordingAsync(session);
      setSessions((current) =>
        current.filter((currentSession) => currentSession.id !== session.id),
      );
      logHistoryEvent("recording_delete_completed", {
        sessionId: session.id,
      });
      showToast({ message: "Recording deleted.", kind: "success" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not delete recording.";
      logHistoryEvent("recording_delete_failed", {
        sessionId: session.id,
        message,
      });
      showToast({ message, kind: "error" });
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Session History</Text>
          <Text style={styles.subtitle}>
            {loading ? "Loading recordings" : `${total} recordings`}
          </Text>
        </View>

        {total === 0 && !loading ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons
              name="microphone-outline"
              size={28}
              color={colors.white30}
            />
            <Text style={styles.emptyTitle}>No recordings yet</Text>
            <Text style={styles.emptyText}>
              Start a recording to add it to history.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {sessions.map((session, index) => (
              <Pressable
                key={session.id}
                style={({ pressed }) => [
                  styles.card,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
                onPress={() => router.push(`/results/${session.id}`)}
              >
                <View style={styles.row}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>#{total - index}</Text>
                  </View>

                  <View style={styles.content}>
                    <Text style={styles.sessionTitle}>
                      {session.title ?? "Recording"}
                    </Text>
                    <Text style={styles.meta}>
                      {formatDateTime(session.createdAt)} -{" "}
                      {formatDurationMs(session.durationMs)}
                    </Text>
                    <View style={styles.pills}>
                      <Pill color={statusColor(session.status)}>
                        {session.status.toUpperCase()}
                      </Pill>
                      {session.fileSizeBytes !== null && (
                        <Pill color={colors.statusNeutral}>
                          {Math.round(session.fileSizeBytes / 1024)} KB
                        </Pill>
                      )}
                    </View>
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      hitSlop={10}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        { opacity: pressed ? 0.65 : 1 },
                      ]}
                      onPress={(event) => {
                        event.stopPropagation();
                        confirmDeleteRecording(session);
                      }}
                    >
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={20}
                        color={colors.danger}
                      />
                    </Pressable>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={colors.white20}
                    />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function statusColor(status: RecordingSession["status"]) {
  switch (status) {
    case "ready":
      return colors.statusGood;
    case "completed":
      return colors.accent;
    default:
      return colors.statusNeutral;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.white,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: colors.white35,
    fontFamily: "monospace",
  },
  list: {
    paddingHorizontal: 24,
    gap: 14,
  },
  card: {
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentBgSubtle,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent,
    fontFamily: "monospace",
  },
  content: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
    lineHeight: 20,
  },
  meta: {
    fontSize: 11,
    color: colors.white38,
    fontFamily: "monospace",
    marginTop: 4,
  },
  pills: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 10,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  emptyCard: {
    marginHorizontal: 24,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 12,
    color: colors.white40,
    textAlign: "center",
    marginTop: 6,
  },
});
