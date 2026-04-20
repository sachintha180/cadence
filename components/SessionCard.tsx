import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import colors from "@/constants/colors";
import { formatDate } from "@/constants/helpers";
import type { Session } from "@/constants/types";

import Pill from "./Pill";

type Props = {
  session: Session;
  onPress: () => void;
};

export default function SessionCard({ session, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.75 : 1 }]}
      onPress={onPress}
    >
      <View style={styles.row}>
        <View style={styles.content}>
          <Text style={styles.title}>{session.title}</Text>
          <Text style={styles.meta}>
            {formatDate(session.date)} · {session.duration}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={18}
          color={colors.white20}
        />
      </View>
      <View style={styles.pills}>
        <Pill color={colors.accent}>Teacher {session.teacherTalk}%</Pill>
        <Pill color={colors.student}>Student {session.studentTalk}%</Pill>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
    lineHeight: 18,
  },
  meta: {
    fontSize: 11,
    color: colors.white40,
    fontFamily: "monospace",
    marginTop: 4,
  },
  pills: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
});
