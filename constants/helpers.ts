import colors from "./colors";
import type { SessionIndicatorStatus } from "./types";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function statusColor(status: SessionIndicatorStatus): string {
  switch (status) {
    case "good":
      return colors.statusGood;
    case "high":
      return colors.statusWarning;
    case "low":
      return colors.student;
    default:
      return colors.statusNeutral;
  }
}

export function statusBg(status: SessionIndicatorStatus): string {
  switch (status) {
    case "good":
      return colors.statusGoodBg;
    case "high":
      return colors.statusWarningBg;
    case "low":
      return colors.statusStudentBg;
    default:
      return colors.statusNeutralBg;
  }
}

export function statusLabel(status: SessionIndicatorStatus): string {
  switch (status) {
    case "good":
      return "Within range";
    case "high":
      return "Above range";
    case "low":
      return "Below range";
    default:
      return "-";
  }
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function formatDurationMs(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
