import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import { formatDate } from "@/constants/helpers";
import { SESSIONS } from "@/constants/sessions";
import SessionCard from "@/components/SessionCard";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top },
        ]}
      >
        {/* Hero Section */}
        <View style={styles.hero}>
          {/* Header Text */}
          <Text style={styles.wordmark}>CADENCE</Text>
          <Text style={styles.greeting}>{"Good morning,\nMr Sachintha."}</Text>
          <Text style={styles.heraMeta}>
            3 sessions analysed - Last on {formatDate("2025-03-03")}
          </Text>

          {/* Record Button */}
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
        </View>

        {/* Recent Sessions */}
        <View style={styles.section}>
          {/* Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
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

          {/* Recent Session List */}
          <View style={styles.sessionList}>
            {SESSIONS.slice(0, 2).map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onPress={() => router.push(`/results/${session.id}`)}
              />
            ))}
          </View>
        </View>

        {/* Stats Strip */}
        <View style={styles.statsCard}>
          {[
            { label: "Sessions", value: "3" },
            { label: "Avg Talk", value: "65%" },
            { label: "Avg Pace", value: "138wpm" },
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
  heraMeta: {
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
