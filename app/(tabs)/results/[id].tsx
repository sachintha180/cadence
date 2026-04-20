import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "@/components/ToastProvider";
import colors from "@/constants/colors";
import type { RecordingSession } from "@/constants/types";
import { formatDateTime, formatDurationMs } from "@/constants/helpers";
import { getRecordingSessionAsync } from "@/services/recordingDb";

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        setLoading(true);
        const nextSession = id ? await getRecordingSessionAsync(id) : null;
        if (!cancelled) {
          setSession(nextSession);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not load recording.";
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

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.mutedText}>Loading recording...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.mutedText}>Recording not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
          <MaterialCommunityIcons
            name="chart-timeline-variant"
            size={36}
            color={colors.white30}
          />
          <Text style={styles.cardTitle}>Analysis not run yet</Text>
          <Text style={styles.cardBody}>
            This recording is saved locally and ready for the preprocessing
            pipeline.
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>STATUS</Text>
            <Text style={styles.metaValue}>{session.status.toUpperCase()}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>FILE SIZE</Text>
            <Text style={styles.metaValue}>
              {session.fileSizeBytes === null
                ? "-"
                : `${Math.round(session.fileSizeBytes / 1024)} KB`}
            </Text>
          </View>
        </View>
      </View>
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
  },
  mutedText: {
    fontSize: 16,
    color: colors.white40,
    fontFamily: "monospace",
    marginBottom: 16,
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
  },
  card: {
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.white,
    marginTop: 16,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.white50,
    marginTop: 8,
    marginBottom: 22,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 12,
    marginTop: 12,
  },
  metaLabel: {
    fontSize: 11,
    color: colors.white40,
    fontFamily: "monospace",
  },
  metaValue: {
    fontSize: 11,
    color: colors.accent,
    fontFamily: "monospace",
  },
});
