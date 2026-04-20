import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import colors from "@/constants/colors";

export default function RootLayout() {
  // Save Area Provider: Ensures content won't bleed under the status bar / navigation buttons
  // Basically a runtime context provider, which enables running seSafeAreaInsets in child routes

  return (
    <SafeAreaProvider>
      {/* Thin top-bar of the app; style='light' renders the icons in white */}
      <StatusBar style="light" />

      {/* Expo Router primitive to tell the screens to stack on top of each other */}
      {/* headerShown: false; hides the default header bar globally */}
      {/* contentStyle: applies a background color to every screen's content area */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgBase },
        }}
      >
        {/* Register the (tabs) route in the stack */}
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}
