Optional browser OpenWakeWord assets go here.

The app exposes a pluggable wake detector in `src/lib/voice/wake-word.ts`. If you add a browser OpenWakeWord runtime, expose it as `window.MistyOpenWakeWord.create({ wakeWord, sensitivity, onDetected, onError })`.

Until those assets are added, the app uses the built-in browser wake-word fallback for "Misty".
