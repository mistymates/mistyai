# Local OpenWakeWord server

This runs wake-word detection on your PC and keeps the browser app focused on UI, Deepgram transcription, Gemini, and TTS.

## Setup

```powershell
cd D:\mistskiv2\local-voice
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Start

```powershell
python wakeword-server.py
```

If `D:\mistskiv2\local-voice\models\Misty.onnx` exists, it will be loaded automatically.

The React app will automatically use:

```txt
http://127.0.0.1:8765
ws://127.0.0.1:8765/wake
```

## Custom model

If you train or download a custom `Misty` OpenWakeWord `.onnx` model, store it in:

```txt
D:\mistskiv2\local-voice\models\Misty.onnx
```

Then start:

```powershell
python wakeword-server.py --model .\models\Misty.onnx
```

Without `--model`, OpenWakeWord loads its default models. A custom `Misty` model is recommended for reliable detection of the exact word.
