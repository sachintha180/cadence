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

See [`notes/DIRECTORY.md`](notes/DIRECTORY.md) for a full annotated file tree.

Key directories:

- `app/` - screens and navigation (Expo Router)
- `components/` - shared UI components
- `services/` - data access and business logic
- `src/` - core ML inference and indicator logic
- `notebooks/` - Python/Jupyter ML pipeline development
- `scripts/` - utility scripts (e.g. SQLite WAL merging)
- `notes/` - project documentation and phase planning

---

## Core Features

- **Record** - four-phase flow: idle -> recording -> on-device processing -> results
- **Indicators** - six acoustic measures with status (within / above / below range)
- **Talk Distribution** - teacher / student / silence breakdown with a donut chart
- **History** - chronological list of all past sessions
- **Import** - import audio files for analysis
- **Reflection Prompts** - session-specific prompts to guide teacher self-review