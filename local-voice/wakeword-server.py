import argparse
import asyncio
import json
import logging
from http import HTTPStatus
from pathlib import Path
from urllib.request import urlretrieve

import numpy as np
import websockets
from openwakeword.model import Model


logging.basicConfig(level=logging.INFO, format="[wakeword] %(message)s")

RESOURCE_BASE_URL = "https://github.com/dscripka/openWakeWord/releases/download/v0.5.1"
REQUIRED_ONNX_RESOURCES = {
    "melspectrogram.onnx": f"{RESOURCE_BASE_URL}/melspectrogram.onnx",
    "embedding_model.onnx": f"{RESOURCE_BASE_URL}/embedding_model.onnx",
}


def ensure_onnx_resources():
    import openwakeword

    pkg_root = Path(openwakeword.__file__).resolve().parent
    model_dir = pkg_root / "resources" / "models"
    model_dir.mkdir(parents=True, exist_ok=True)

    for filename, url in REQUIRED_ONNX_RESOURCES.items():
        target = model_dir / filename
        if target.exists():
            continue
        logging.info("Downloading missing OpenWakeWord resource: %s", filename)
        urlretrieve(url, target)


def load_model(model_path: str | None):
    ensure_onnx_resources()

    if not model_path:
        local_models_dir = Path(__file__).resolve().parent / "models"
        preferred_names = ("Misty.onnx", "misty.onnx")
        for filename in preferred_names:
            candidate = local_models_dir / filename
            if candidate.exists():
                model_path = str(candidate)
                break

    if model_path:
        path = Path(model_path).expanduser().resolve()
        logging.info("Loading OpenWakeWord model: %s", path)
        return Model(wakeword_models=[str(path)], inference_framework="onnx")

    logging.info("Loading OpenWakeWord default models")
    return Model()


def best_score(prediction: dict, wake_word: str):
    if not prediction:
        return 0.0, ""

    lowered = wake_word.lower()
    candidates = []
    for name, score in prediction.items():
        try:
            value = float(score)
        except (TypeError, ValueError):
            continue
        candidates.append((name, value))

    if not candidates:
        return 0.0, ""

    exact = [item for item in candidates if lowered in item[0].lower()]
    name, score = max(exact or candidates, key=lambda item: item[1])
    return score, name


async def wake_socket(websocket, model: Model):
    wake_word = "misty"
    sensitivity = 0.55
    sample_rate = 16000
    cooldown_until = 0.0

    async for message in websocket:
        if isinstance(message, str):
            try:
                config = json.loads(message)
            except json.JSONDecodeError:
                continue

            if config.get("type") == "config":
                wake_word = str(config.get("wakeWord", wake_word)).lower()
                sensitivity = float(config.get("sensitivity", sensitivity))
                sample_rate = int(config.get("sampleRate", sample_rate))
                logging.info(
                    "Client configured wake_word=%s sensitivity=%.2f sample_rate=%s",
                    wake_word,
                    sensitivity,
                    sample_rate,
                )
            continue

        if sample_rate != 16000:
            await websocket.send(
                json.dumps({"type": "error", "message": "OpenWakeWord server expects 16kHz PCM16"})
            )
            continue

        audio = np.frombuffer(message, dtype=np.int16)
        if audio.size == 0:
            continue

        prediction = model.predict(audio)
        score, model_name = best_score(prediction, wake_word)
        now = asyncio.get_running_loop().time()

        if score >= sensitivity and now >= cooldown_until:
            cooldown_until = now + 1.2
            logging.info("Detected %s score=%.3f model=%s", wake_word, score, model_name)
            await websocket.send(
                json.dumps(
                    {
                        "type": "wake",
                        "wakeWord": wake_word,
                        "score": score,
                        "model": model_name,
                    }
                )
            )


async def process_request(connection, request):
    if request.path == "/health":
        response = connection.respond(HTTPStatus.OK, "ok\n")
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Cache-Control"] = "no-store"
        return response

    return None


async def main():
    parser = argparse.ArgumentParser(description="Local OpenWakeWord server for Misty")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    parser.add_argument("--model", default=None, help="Optional custom .onnx wake-word model")
    args = parser.parse_args()

    model = load_model(args.model)

    async def handler(websocket):
        request = getattr(websocket, "request", None)
        path = request.path if request else ""
        if path != "/wake":
            await websocket.close()
            return
        await wake_socket(websocket, model)

    logging.info("Listening on ws://%s:%s/wake", args.host, args.port)
    async with websockets.serve(handler, args.host, args.port, process_request=process_request):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
