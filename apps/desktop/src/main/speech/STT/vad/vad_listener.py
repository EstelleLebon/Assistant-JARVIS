
import json
import queue
import sys
import numpy as np
import sounddevice as sd
import logging
from logging.handlers import RotatingFileHandler
import os

from silero_vad import (
    load_silero_vad,
    get_speech_timestamps
)

# Logger setup
LOG_PATH = "/data/assistant/apps/desktop/logs/vad.log"
logger = logging.getLogger("vad")
logger.setLevel(logging.INFO)
handler = RotatingFileHandler(LOG_PATH, maxBytes=1_000_000, backupCount=3, encoding="utf-8")
formatter = logging.Formatter("[%(levelname)s] %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)

def log_info(msg):
    logger.info(msg)

def log_error(msg):
    logger.error(msg)

SAMPLE_RATE = 16000
BLOCKSIZE = 512

try:
    model = load_silero_vad()
    log_info("Silero VAD model loaded successfully.")
except Exception as e:
    log_error(f"Failed to load Silero VAD model: {e}")
    sys.exit(1)

audio_queue = queue.Queue()

speech_active = False
silence_ms = 0

buffer = np.array([], dtype=np.float32)

def audio_callback(indata, frames, time, status):
    if status:
        log_error(f"Audio callback status: {status}")
        return
    try:
        audio_queue.put(indata[:, 0].copy())
    except Exception as e:
        log_error(f"audio_callback error: {e}")

try:
    stream = sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=1,
        blocksize=BLOCKSIZE,
        dtype="float32",
        callback=audio_callback
    )
    stream.start()
    log_info("Audio stream started.")
except Exception as e:
    log_error(f"Failed to start audio stream: {e}")
    print(json.dumps({"type": "error", "message": "audio_stream_failed"}), flush=True)
    sys.exit(1)

print(json.dumps({"type": "ready"}), flush=True)
log_info("VAD listener ready.")

try:
    while True:
        try:
            chunk = audio_queue.get()
        except Exception as e:
            log_error(f"audio_queue.get error: {e}")
            continue
        buffer = np.concatenate([buffer, chunk])
        # garde ~1 sec
        if len(buffer) > SAMPLE_RATE:
            buffer = buffer[-SAMPLE_RATE:]
        try:
            speech = get_speech_timestamps(
                buffer,
                model,
                sampling_rate=SAMPLE_RATE
            )
        except Exception as e:
            log_error(f"get_speech_timestamps error: {e}")
            speech = []
        detected = len(speech) > 0
        if detected and not speech_active:
            speech_active = True
            print(json.dumps({"type": "speech_start"}), flush=True)
            log_info("speech_start detected")
        elif not detected and speech_active:
            silence_ms += 32
            if silence_ms > 700:
                speech_active = False
                silence_ms = 0
                print(json.dumps({"type": "speech_end"}), flush=True)
                log_info("speech_end detected")
        else:
            silence_ms = 0
except Exception as e:
    log_error(f"Main loop crashed: {e}")
    print(json.dumps({"type": "error", "message": "vad_crash"}), flush=True)