import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import {
  formatDate,
  statusColor,
  statusBg,
  statusLabel,
} from "@/constants/helpers";
import { SESSIONS } from "@/constants/sessions";

const INDICATOR_ORDER = [
  "pacing",
  "pauses",
  "fillers",
  "prosody",
  "turns",
  "longestMonologue",
];

type ResultTab = "overview" | "indicators" | "prompts";

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<ResultTab>("overview");

  const session = SESSIONS.find((s) => s.id === Number(id));

  if (!session) {
    return (
      <View style={[styles.container, styles.notFound]}>
        <Text style={styles.notFoundText}>Session not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const orderedIndicators = INDICATOR_ORDER.map((key) => ({
    key,
    ...session.indicators[key],
  })).filter(Boolean);

  const talkRows = [
    { label: "Teacher", value: session.teacherTalk, color: colors.accent },
    { label: "Student", value: session.studentTalk, color: colors.student },
    { label: "Silence", value: session.silence, color: colors.white25 },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
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
          {formatDate(session.date)} - {session.duration}
        </Text>
        <Text style={styles.headerTitle}>{session.title}</Text>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {(["overview", "indicators", "prompts"] as ResultTab[]).map((t) => (
            <Pressable key={t} style={styles.tabItem} onPress={() => setTab(t)}>
              <Text
                style={[styles.tabLabel, tab === t && styles.tabLabelActive]}
              >
                {t.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Tab Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tab === "overview" && (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>TALK DISTRIBUTION</Text>
              {talkRows.map((row) => (
                <View key={row.label} style={styles.talkRow}>
                  <View style={styles.talkLabelRow}>
                    <Text style={[styles.talkLabel, { color: row.color }]}>
                      {row.label}
                    </Text>
                    <Text style={[styles.talkPercent, { color: row.color }]}>
                      {row.value}%
                    </Text>
                  </View>
                  <View style={styles.talkBarTrack}>
                    <View
                      style={[
                        styles.talkBarFill,
                        {
                          width: `${row.value}%` as `${number}%`,
                          backgroundColor: row.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.grid}>
              {orderedIndicators.slice(0, 4).map((ind) => {
                const sc = statusColor(ind.status);
                const sb = statusBg(ind.status);
                const sl = statusLabel(ind.status);
                return (
                  <View
                    key={ind.key}
                    style={[
                      styles.miniCard,
                      { backgroundColor: sb, borderColor: `${sc}22` },
                    ]}
                  >
                    <Text style={styles.miniCardLabel}>
                      {ind.label.toUpperCase()}
                    </Text>
                    <View style={styles.miniCardValueRow}>
                      <Text style={styles.miniCardValue}>{ind.value}</Text>
                      <Text style={styles.miniCardUnit}>{ind.unit}</Text>
                    </View>
                    <Text style={[styles.miniCardStatus, { color: sc }]}>
                      {sl}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {tab === "indicators" && (
          <View style={styles.indicatorList}>
            {orderedIndicators.map((ind) => {
              const sc = statusColor(ind.status);
              const sl = statusLabel(ind.status);
              return (
                <View
                  key={ind.key}
                  style={[styles.indicatorCard, { borderColor: `${sc}22` }]}
                >
                  <View style={styles.indicatorLeft}>
                    <Text style={styles.indicatorLabel}>
                      {ind.label.toUpperCase()}
                    </Text>
                    <View style={styles.indicatorValueRow}>
                      <Text style={styles.indicatorValue}>{ind.value}</Text>
                      <Text style={styles.indicatorUnit}>{ind.unit}</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: `${sc}18`, borderColor: `${sc}44` },
                    ]}
                  >
                    <Text style={[styles.statusPillText, { color: sc }]}>
                      {sl}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {tab === "prompts" && (
          <View style={styles.promptList}>
            <Text style={styles.disclaimer}>
              These prompts are designed to support your reflection — not to
              evaluate your practice.
            </Text>
            {session.prompts.map((prompt, index) => (
              <View key={index} style={styles.promptCard}>
                <Text style={styles.promptLabel}>
                  REFLECTION {String(index + 1).padStart(2, "0")}
                </Text>
                <Text style={styles.promptBody}>{prompt}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  notFound: {
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundText: {
    fontSize: 16,
    color: colors.white40,
    fontFamily: "monospace",
    marginBottom: 16,
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
  tabBar: {
    flexDirection: "row",
    marginTop: 20,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabLabel: {
    fontSize: 12,
    color: colors.white40,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  tabLabelActive: {
    color: colors.accent,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 100,
    gap: 16,
  },
  card: {
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 24,
  },
  sectionLabel: {
    fontSize: 12,
    color: colors.white50,
    fontFamily: "monospace",
    letterSpacing: 1,
    marginBottom: 16,
  },
  talkRow: {
    marginBottom: 12,
  },
  talkLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  talkLabel: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  talkPercent: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  talkBarTrack: {
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.white08,
    overflow: "hidden",
  },
  talkBarFill: {
    height: 4,
    borderRadius: 99,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  miniCard: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    paddingHorizontal: 16,
  },
  miniCardLabel: {
    fontSize: 10,
    color: colors.white40,
    fontFamily: "monospace",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  miniCardValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  miniCardValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.white,
  },
  miniCardUnit: {
    fontSize: 11,
    color: colors.white40,
  },
  miniCardStatus: {
    fontSize: 10,
    fontFamily: "monospace",
    marginTop: 4,
  },
  indicatorList: {
    gap: 12,
  },
  indicatorCard: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  indicatorLeft: {
    flex: 1,
  },
  indicatorLabel: {
    fontSize: 11,
    color: colors.white40,
    fontFamily: "monospace",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  indicatorValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  indicatorValue: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.white,
  },
  indicatorUnit: {
    fontSize: 12,
    color: colors.white40,
    fontFamily: "monospace",
  },
  statusPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 99,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: "monospace",
  },
  promptList: {
    gap: 14,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.white35,
    fontFamily: "monospace",
    lineHeight: 18,
    marginBottom: 4,
  },
  promptCard: {
    backgroundColor: colors.cardBg,
    padding: 18,
    paddingHorizontal: 20,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  promptLabel: {
    fontSize: 10,
    color: colors.accent,
    fontFamily: "monospace",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  promptBody: {
    fontSize: 14,
    color: colors.white82,
    lineHeight: 23,
  },
});
