import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import { SESSIONS } from "@/constants/sessions";
import { formatElapsed } from "@/constants/helpers";
import type { RecordingPhase } from "@/constants/types";

const PROCESSING_STEPS = [
  { label: "Extracting acoustic features...", target: 30, delay: 600 },
  { label: "Running speaker diarization...", target: 55, delay: 1400 },
  { label: "Probing Wav2Vec 2.0 embeddings...", target: 78, delay: 1200 },
  { label: "Computing diagnostic indicators...", target: 95, delay: 1000 },
  { label: "Generating reflective prompts...", target: 100, delay: 800 },
];

export default function RecordScreen() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [processLabel, setProcessLabel] = useState("Initialising pipeline...");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === "recording") {
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  function startProcessing() {
    let currentProgress = 0;

    function runStep(stepIndex: number) {
      if (stepIndex >= PROCESSING_STEPS.length) {
        setTimeout(() => setPhase("done"), 400);
        return;
      }
      const step = PROCESSING_STEPS[stepIndex];
      setProcessLabel(step.label);

      const interval = setInterval(() => {
        currentProgress += 1;
        setProgress(currentProgress);
        if (currentProgress >= step.target) {
          clearInterval(interval);
          setTimeout(() => runStep(stepIndex + 1), step.delay);
        }
      }, 18);
    }

    runStep(0);
  }

  function handleBeginRecording() {
    setElapsed(0);
    setPhase("recording");
  }

  function handleStopAndAnalyse() {
    setPhase("processing");
    setProgress(0);
    setProcessLabel("Initialising pipeline...");
    startProcessing();
  }

  function handleViewResults() {
    router.push(`/results/${SESSIONS[0].id}`);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 32 },
        ]}
      >
        <View style={styles.inner}>
          {phase === "idle" && (
            <>
              {/* New Recording Text Header */}
              <Text style={styles.title}>New Recording</Text>
              <Text style={styles.subtitle}>
                Position your device to capture the classroom
              </Text>

              {/* Waveform Icon */}
              <View style={styles.card}>
                <MaterialCommunityIcons
                  name="waveform"
                  size={48}
                  color={colors.white15}
                />
                <Text style={styles.timerInactive}>{formatElapsed(0)}</Text>
              </View>

              {/* Begin Recording Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={handleBeginRecording}
              >
                <Text style={styles.primaryButtonText}>Begin Recording</Text>
              </Pressable>
            </>
          )}

          {phase === "recording" && (
            <>
              {/* Recording Icon + Label */}
              <View style={styles.recordingBadge}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>RECORDING</Text>
              </View>

              {/* Recording Timer */}
              <View style={[styles.card, styles.cardAccentBorder]}>
                <MaterialCommunityIcons
                  name="waveform"
                  size={48}
                  color={colors.accent}
                />
                <Text style={styles.timerActive}>{formatElapsed(elapsed)}</Text>
              </View>

              {/* Recording Stop */}
              <Pressable
                style={({ pressed }) => [
                  styles.dangerButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={handleStopAndAnalyse}
              >
                <Text style={styles.dangerButtonText}>Stop & Analyse</Text>
              </Pressable>
            </>
          )}

          {phase === "processing" && (
            <>
              {/* Session Analysis Mockup */}
              <Text style={styles.title}>Analysing Session</Text>
              <Text style={styles.subtitle}>
                On-device - No data leaves your phone
              </Text>
              <View style={styles.card}>
                <Text style={styles.progressPercent}>{progress}%</Text>
              </View>
              <Text style={styles.processLabel}>{processLabel}</Text>
            </>
          )}

          {phase === "done" && (
            <>
              {/* Analysis Complete Header */}
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={40}
                color={colors.accent}
                style={styles.doneIcon}
              />
              <Text style={styles.title}>Analysis Complete</Text>
              <Text style={styles.subtitle}>
                Your session is ready to review
              </Text>

              {/* View Results Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={handleViewResults}
              >
                <Text style={styles.primaryButtonText}>View Results</Text>
              </Pressable>
            </>
          )}
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
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 100,
    alignItems: "center",
  },
  inner: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.white,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.white40,
    fontFamily: "monospace",
    textAlign: "center",
    marginBottom: 24,
  },
  card: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  cardAccentBorder: {
    borderColor: colors.accentBorderStrong,
  },
  timerInactive: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.white20,
    fontFamily: "monospace",
    marginTop: 16,
    textAlign: "center",
  },
  timerActive: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.accent,
    fontFamily: "monospace",
    marginTop: 16,
    textAlign: "center",
  },
  recordingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.danger,
  },
  recordingText: {
    fontSize: 12,
    color: colors.danger,
    fontFamily: "monospace",
  },
  progressPercent: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.accent,
    fontFamily: "monospace",
    textAlign: "center",
    paddingVertical: 16,
  },
  processLabel: {
    fontSize: 12,
    color: colors.white50,
    fontFamily: "monospace",
    textAlign: "center",
    marginTop: -8,
    marginBottom: 24,
  },
  doneIcon: {
    marginBottom: 12,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.bgSurface,
  },
  dangerButton: {
    width: "100%",
    backgroundColor: colors.dangerBgAlt,
    borderWidth: 1,
    borderColor: colors.dangerBorderStrong,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.danger,
  },
});
