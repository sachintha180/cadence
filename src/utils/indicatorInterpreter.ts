export const SPEECH_HIGH = 0.7;
export const SPEECH_MODERATE = 0.45;

export const ENERGY_CONSISTENT = 0.008;
export const ENERGY_VARIABLE = 0.015;

export const PAUSE_LOW = 1.5;
export const PAUSE_HIGH = 4;

export const PROSODY_FLAT = 0.09;
export const PROSODY_VARIED = 0.12;

export type SessionSummaryInput = {
  speechRatio: number;
  stdRms: number;
  meanPausesPerChunk: number;
  embeddingStd: number | null;
};

export function interpretSpeechActivity(ratio: number) {
  if (ratio >= SPEECH_HIGH) {
    return "Speech was detected for most of this session";
  }

  if (ratio >= SPEECH_MODERATE) {
    return "Balanced mix of teacher speech and silence";
  }

  return "High proportion of silence or student activity detected";
}

export function interpretEnergyConsistency(stdRms: number) {
  if (stdRms <= ENERGY_CONSISTENT) {
    return "Very consistent vocal energy throughout";
  }

  if (stdRms <= ENERGY_VARIABLE) {
    return "Moderate variation in vocal energy";
  }

  return "Notable variation in loudness across the session";
}

export function interpretPauseFrequency(meanPausesPerChunk: number) {
  if (meanPausesPerChunk < PAUSE_LOW) {
    return "Few pauses detected - consider adding more deliberate pauses for student processing time";
  }

  if (meanPausesPerChunk <= PAUSE_HIGH) {
    return "Good pause frequency - supports student comprehension";
  }

  return "High pause frequency detected - may indicate hesitation or background noise interference";
}

export function interpretProsody(embeddingStd: number) {
  if (embeddingStd < PROSODY_FLAT) {
    return "Relatively flat vocal delivery - consider varying tone and emphasis to maintain engagement";
  }

  if (embeddingStd < PROSODY_VARIED) {
    return "Moderate prosodic variation - reasonable vocal expressiveness detected";
  }

  return "Good prosodic variation - vocal delivery appears expressive and varied";
}

export function generateSessionSummary({
  speechRatio,
  stdRms,
  meanPausesPerChunk,
  embeddingStd,
}: SessionSummaryInput) {
  const speech =
    speechRatio >= SPEECH_HIGH
      ? "Active session"
      : speechRatio >= SPEECH_MODERATE
        ? "Balanced session"
        : "Quiet session";

  const energy =
    stdRms <= ENERGY_CONSISTENT
      ? "with consistent energy"
      : stdRms <= ENERGY_VARIABLE
        ? "with moderate energy variation"
        : "with variable energy";

  const pause =
    meanPausesPerChunk < PAUSE_LOW
      ? "and minimal pauses"
      : meanPausesPerChunk <= PAUSE_HIGH
        ? "and well-paced delivery"
        : "and frequent pauses";

  const prosody =
    embeddingStd === null
      ? ""
      : embeddingStd < PROSODY_FLAT
        ? " - vocal delivery was relatively flat"
        : embeddingStd < PROSODY_VARIED
          ? " - vocal delivery was moderately expressive"
          : " - vocal delivery was expressive and varied";

  return `${speech} ${energy} ${pause}${prosody}.`;
}
