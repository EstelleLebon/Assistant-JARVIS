
import asyncio
import os
import signal
import subprocess
import json
import numpy as np
import websockets
import logging
from datetime import datetime
from faster_whisper import WhisperModel

# Logging setup
LOG_PATH = "/data/assistant/apps/desktop/logs/asr_server.log"
logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
    ]
)

def log_info(msg):
    logging.info(msg)

def log_error(msg):
    logging.error(msg)

log_info("Loading model...")

try:

    model = WhisperModel(
        "small",
        device="cuda",
        compute_type="float16"
    )
    log_info("Using CUDA")

except Exception as e:
    log_error(f"CUDA failed, fallback CPU: {e}")
    model = WhisperModel(
        "small",
        device="cpu",
        compute_type="int8"
    )

log_info("Model loaded, starting server...")

audio_buffer = np.array(
    [],
    dtype=np.float32
)

last_partial = ""

is_speaking = False
speech_end_task = None
initial_prompt = None


def clean_text(text: str):

    text = text.strip()

    banned = [
        "Merci.",
        "Merci beaucoup.",
        "[Musique]",
        "Sous-titres"
    ]

    if text in banned:
        return ""

    return text


def reset_state():

    global audio_buffer
    global last_partial
    global initial_prompt

    audio_buffer = np.array(
        [],
        dtype=np.float32
    )

    last_partial = ""
    initial_prompt = None


async def send_partial(ws, text):

    await ws.send(json.dumps({
        "type": "partial",
        "text": text
    }))


async def send_final(ws, text):

    await ws.send(json.dumps({
        "type": "final",
        "text": text
    }))


async def transcribe_loop(ws):

    global audio_buffer
    global last_partial
    global is_speaking
    global initial_prompt

    while True:

        await asyncio.sleep(0.55)

        """
        DO NOT DECODE
        DURING SILENCE
        """

        if not is_speaking:
            continue

        if len(audio_buffer) < 16000:
            continue

        audio = audio_buffer.copy()

        try:

            segments, info = model.transcribe(
                audio,
                language="fr",

                beam_size=1,
                best_of=1,
                temperature=0,

                condition_on_previous_text=True,
                vad_filter=False,

                initial_prompt=initial_prompt
            )

            text = " ".join(
                segment.text
                for segment in segments
            ).strip()

            text = clean_text(text)

            if not text:
                continue

            if text == last_partial:
                continue

            last_partial = text

            await send_partial(
                ws,
                text
            )

        except Exception as e:

            log_error(f"transcribe error: {e}")


async def finalize_after_silence(ws):

    global is_speaking
    global last_partial

    await asyncio.sleep(1.8)

    """
    User resumed speaking
    """

    if is_speaking:
        return

    final = clean_text(
        last_partial
    )

    if final:

        await send_final(
            ws,
            final
        )

    """
    HARD RESET
    """

    reset_state()


async def handler(ws):

    global audio_buffer
    global is_speaking
    global speech_end_task

    log_info("client connected")

    asyncio.create_task(
        transcribe_loop(ws)
    )

    async for message in ws:

        """
        JSON EVENT
        """

        if isinstance(message, str):

            try:

                event = json.loads(message)

                if (
                    event["type"] ==
                    "speech_start"
                ):

                    initial_prompt = event.get("initial_prompt", None)
                    if event.get("reset", False):
                        reset_state()
                        log_info(f"speech_start new session (prompt={initial_prompt!r})")
                    else:
                        log_info("speech_start resume")

                    is_speaking = True

                    if speech_end_task:

                        speech_end_task.cancel()
                        speech_end_task = None

                    continue

                if (
                    event["type"] ==
                    "speech_end"
                ):

                    log_info("speech_end")

                    is_speaking = False

                    speech_end_task = (
                        asyncio.create_task(
                            finalize_after_silence(ws)
                        )
                    )

                    continue

            except Exception as e:

                log_error(f"event parse error: {e}")

                continue

        """
        AUDIO
        """

        audio = np.frombuffer(
            message,
            dtype=np.float32
        )

        audio_buffer = np.concatenate([
            audio_buffer,
            audio
        ])

        """
        Keep last 12 sec
        """

        max_samples = 16000 * 12

        if len(audio_buffer) > max_samples:

            audio_buffer = (
                audio_buffer[-max_samples:]
            )


async def main():

    import socket

    port = 8765

    try:

        result = subprocess.run(
            [
                "lsof",
                "-i",
                f":{port}",
                "-t"
            ],
            capture_output=True,
            text=True
        )

        pids = [
            int(pid)
            for pid in (
                result.stdout
                .strip()
                .split("\n")
            )
            if pid.strip()
        ]

        for pid in pids:

            print(
                f"Killing process {pid}"
            )

            os.kill(
                pid,
                signal.SIGKILL
            )

    except Exception as e:

        print(
            "Could not cleanup port:",
            e
        )

    for _ in range(50):

        with socket.socket(
            socket.AF_INET,
            socket.SOCK_STREAM
        ) as s:

            try:

                s.bind(
                    ("127.0.0.1", port)
                )

                break

            except OSError:

                await asyncio.sleep(0.2)

    else:

        raise RuntimeError(
            f"Port {port} still busy"
        )

    async with websockets.serve(
        handler,
        "0.0.0.0",
        8765,
        max_size=None
    ):

        print(
            "ASR server started",
            flush=True
        )

        await asyncio.Future()


asyncio.run(main())