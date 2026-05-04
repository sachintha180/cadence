# Cadence

A React Native (Expo) app that helps teachers reflect on their classroom practice. It records audio, runs on-device ML analysis, and surfaces acoustic indicators - speaking pace, pause length, filler words, prosodic variation, turn-taking events, and teacher/student talk distribution - alongside AI-generated reflection prompts.

All processing happens on-device. No audio leaves the phone.

---

## Tech Stack

| Layer          | Technology                        |
| -------------- | --------------------------------- |
| Framework      | Expo (React Native) + Expo Router |
| Language       | TypeScript                        |
| Navigation     | File-based tabs + stack (`app/`)  |
| Storage        | `expo-sqlite`                     |
| Audio          | `react-native-audio-api`          |
| ML Inference   | `react-native-fast-tflite`        |
| ML Development | Python + Jupyter notebooks        |

---

## Getting Started

```bash
npm install
npm start          # Expo dev server
npm run android    # Run on Android
npm test           # Jest unit tests
```

> Requires the [Expo Go](https://expo.dev/client) app or a local dev build for device testing.

---

## Project Structure

```
cadence/
├── app/                        # Expo Router screens and navigation layout
│   ├── (tabs)/                 # Tab-based navigation group
│   │   ├── _layout.tsx         # Tab navigator configuration
│   │   ├── index.tsx           # Home screen
│   │   ├── history.tsx         # Recording history screen
│   │   ├── record.tsx          # Recording screen
│   │   └── results/
│   │       └── [id].tsx        # Dynamic results screen (per recording)
│   ├── _layout.tsx             # Root app layout
│   └── import.tsx              # File import screen
│
├── assets/
│   └── images/                 # App icons and splash screen images
│
├── components/                 # Shared React Native UI components
│   ├── ModelProvider.tsx       # Context provider for ML model state
│   ├── Pill.tsx                # Pill/badge UI component
│   └── ToastProvider.tsx       # Toast notification context provider
│
├── constants/                  # App-wide constants and shared types
│   ├── colors.ts               # Color palette
│   ├── helpers.ts              # General utility/helper functions
│   ├── recording.ts            # Recording-related constants
│   └── types.ts                # Shared TypeScript types
│
├── notebooks/                                       # Jupyter notebooks for ML pipeline development
│   ├── encoder_pipeline.ipynb                       # Audio encoder experimentation
│   ├── eval_pipeline.ipynb                          # Model evaluation pipeline
│   ├── preprocessing_pipeline_random_samples.ipynb  # Preprocessing experiments
│   └── stub_pipeline.ipynb                          # Stub/baseline pipeline
│
├── scripts/                    # Standalone utility scripts
│   └── merge_wal.py            # Merges SQLite WAL files into the main DB
│
├── services/                   # Data access and business logic services
│   ├── analysisDb.ts           # Analysis results database operations
│   ├── analysisLog.ts          # Analysis event logging
│   ├── audioPreprocessing.ts   # Audio preprocessing utilities
│   ├── dbLog.ts                # General database logging
│   ├── importLog.ts            # Import event logging
│   ├── recordingDb.ts          # Recording database operations
│   ├── recordingDelete.ts      # Recording deletion logic
│   ├── recordingFiles.ts       # Recording file management
│   ├── recordingLog.ts         # Recording event logging
│   ├── sessionProcessing.ts    # Session-level processing orchestration
│   └── storageLog.ts           # Storage event logging
│
├── src/                                    # Core ML and indicator logic
│   ├── constants/
│   │   └── vadConfig.ts                    # Voice activity detection configuration
│   ├── db/
│   │   └── indicatorRepository.ts          # Indicator data persistence
│   ├── ml/                                 # ML inference and model management
│   │   ├── __tests__/
│   │   │   └── indicatorExtractor.test.ts  # Unit tests for indicator extractor
│   │   ├── indicatorExtractor.ts           # Extracts indicators from model output
│   │   ├── inferenceEngine.ts              # Runs ML inference on audio features
│   │   └── modelLoader.ts                  # Loads and manages ONNX/TFLite models
│   ├── types/
│   │   └── indicators.ts                   # TypeScript types for indicator data
│   └── utils/
│       └── indicatorInterpreter.ts         # Interprets and scores indicator values
│
├── .gitignore
├── .python-version             # Python version pin (for notebooks/scripts)
├── app.json                    # Expo app configuration
├── index.ts                    # App entry point
├── metro.config.js             # Metro bundler configuration
├── package.json                # Node dependencies and scripts
├── package-lock.json           # Locked dependency tree
└── tsconfig.json               # TypeScript compiler configuration
```

---

## Core Features

- **Record** - four-phase flow: idle -> recording -> on-device processing -> results
- **Indicators** - six acoustic measures with status (within / above / below range)
- **Talk Distribution** - teacher / student / silence breakdown with a donut chart
- **History** - chronological list of all past sessions
- **Import** - import audio files for analysis
- **Reflection Prompts** - session-specific prompts to guide teacher self-review