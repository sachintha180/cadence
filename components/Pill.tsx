import React from "react";
import { Text, StyleSheet } from "react-native";

type Props = {
  color: string;
  children: React.ReactNode;
};

export default function Pill({ color, children }: Props) {
  return (
    <Text
      style={[
        styles.pill,
        {
          color,
          backgroundColor: `${color}18`,
          borderColor: `${color}44`,
        },
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  pill: {
    fontSize: 10,
    fontFamily: "monospace",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 99,
    borderWidth: 1,
    overflow: "hidden",
  },
});
