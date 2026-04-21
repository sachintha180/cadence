// "vad" stands for "Voice Activity Detection"

// All thresholds in one place. Tune these during evaluation without changing
// the implementation files that consume them.
export const VAD_CONFIG = {
  /**
   * Silero VAD probability threshold. Frames with probability above this value
   * are classified as speech. Conservative default is 0.5; practical range is
   * 0.3 for lenient detection to 0.7 for stricter detection in noisy rooms.
   */
  SPEECH_PROBABILITY_THRESHOLD: 0.5,

  /**
   * Minimum consecutive silence duration, in milliseconds, to count as a
   * deliberate pause rather than a micro-hesitation.
   */
  PAUSE_MIN_DURATION_MS: 300,

  /**
   * Minimum consecutive speech duration, in milliseconds, to count as an
   * utterance rather than a short noise burst.
   */
  SPEECH_MIN_DURATION_MS: 200,

  /**
   * RMS frame duration, in milliseconds, for energy consistency computation.
   * At 16 kHz this is 320 samples.
   */
  RMS_FRAME_DURATION_MS: 20,

  /**
   * A chunk is an energy drop event when its mean RMS is below this fraction
   * of the session mean RMS.
   */
  ENERGY_DROP_THRESHOLD_RATIO: 0.6,
} as const;
