import type { ComponentProps } from "react";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type TabIconProps = {
  name: IconName;
  color: string;
  size: number;
};

function TabIcon({ name, color, size }: TabIconProps) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgBase,
          borderTopColor: colors.cardBorder,
          borderTopWidth: 1,
          paddingTop: 12,
          paddingBottom: bottomPadding,
          height: 52 + bottomPadding,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.white30,
        tabBarLabelStyle: {
          fontSize: 10,
          letterSpacing: 1.0,
          fontFamily: "monospace",
          marginTop: 2,
        },
      }}
    >
      {/* Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: "HOME",
          tabBarIcon: ({ color }) => (
            <TabIcon name="view-dashboard-outline" color={color} size={18} />
          ),
        }}
      />

      {/* Record Tab */}
      <Tabs.Screen
        name="record"
        options={{
          title: "RECORD",
          tabBarIcon: ({ color }) => (
            <TabIcon name="microphone" color={color} size={22} />
          ),
        }}
      />

      {/* History Tab */}
      <Tabs.Screen
        name="history"
        options={{
          title: "HISTORY",
          tabBarIcon: ({ color }) => (
            <TabIcon name="history" color={color} size={18} />
          ),
        }}
      />

      {/* (Hidden) Results Tab */}
      <Tabs.Screen name="results/[id]" options={{ href: null }} />
    </Tabs>
  );
}
