import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import { formatDate, statusColor } from "@/constants/helpers";
import { SESSIONS } from "@/constants/sessions";
import Pill from "@/components/Pill";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const total = SESSIONS.length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Session History</Text>
          <Text style={styles.subtitle}>{total} sessions - chronological</Text>
        </View>

        {/* History View */}
        <View style={styles.list}>
          {SESSIONS.map((session, index) => {
            const pacingStatus = session.indicators.pacing?.status;
            const pacingColor = pacingStatus
              ? statusColor(pacingStatus)
              : colors.statusNeutral;
            const pacingValue = session.indicators.pacing?.value;

            return (
              <Pressable
                key={session.id}
                style={({ pressed }) => [
                  styles.card,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
                onPress={() => router.push(`/results/${session.id}`)}
              >
                <View style={styles.row}>
                  {/* Session Index */}
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>#{total - index}</Text>
                  </View>

                  {/* Session Details */}
                  <View style={styles.content}>
                    <Text style={styles.sessionTitle}>{session.title}</Text>
                    <Text style={styles.meta}>
                      {formatDate(session.date)} - {session.duration}
                    </Text>
                    <View style={styles.pills}>
                      <Pill color={colors.accent}>
                        Teacher {session.teacherTalk}%
                      </Pill>
                      <Pill color={colors.student}>
                        Student {session.studentTalk}%
                      </Pill>
                      <Pill color={pacingColor}>{pacingValue} wpm</Pill>
                    </View>
                  </View>

                  {/* More Icon */}
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={colors.white20}
                  />
                </View>
              </Pressable>
            );
          })}
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
});
