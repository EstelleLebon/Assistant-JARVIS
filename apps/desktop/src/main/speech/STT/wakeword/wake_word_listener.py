"""
Détection du wake word "Jarvis" via OpenWakeWord.
Reçoit --model <chemin_onnx>, écrit "DETECTED" sur stdout à chaque détection.
Usage: python3 wake_word_listener.py --model ./models/jarvis.onnx
"""

import argparse
import ctypes
import sys
import warnings
import numpy as np

# Supprime les erreurs ALSA (pcm_dsnoop, pcm_dmix, PCM inconnus...) qui
# polluent stderr sans impact sur le fonctionnement — libasound les émet
# systématiquement à l'ouverture des périphériques audio virtuels absents.
try:
    _ALSA_ERROR_HANDLER_TYPE = ctypes.CFUNCTYPE(
        None, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p
    )
    _ALSA_ERROR_HANDLER = _ALSA_ERROR_HANDLER_TYPE(lambda *_: None)
    ctypes.cdll.LoadLibrary("libasound.so.2").snd_lib_error_set_handler(_ALSA_ERROR_HANDLER)
except OSError:
    pass

# Supprime le UserWarning onnxruntime sur CUDAExecutionProvider absent
warnings.filterwarnings("ignore", category=UserWarning, module="onnxruntime")

import pyaudio
from openwakeword.model import Model

CHUNK = 1280       # 80ms à 16kHz — fenêtre recommandée par OpenWakeWord
SAMPLE_RATE = 16000
THRESHOLD = 0.6    # Score minimum pour déclencher la détection

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Chemin vers le fichier .onnx du wake word")
    parser.add_argument("--threshold", type=float, default=THRESHOLD)
    args = parser.parse_args()

    try:
        oww = Model(wakeword_models=[args.model], inference_framework="onnx")
    except Exception as e:
        print(f"[wake_word] Impossible de charger le modèle : {e}", file=sys.stderr)
        sys.exit(1)

    pa = pyaudio.PyAudio()
    try:
        stream = pa.open(
            rate=SAMPLE_RATE,
            channels=1,
            format=pyaudio.paInt16,
            input=True,
            frames_per_buffer=CHUNK,
        )
    except Exception as e:
        print(f"[wake_word] Impossible d'ouvrir le microphone : {e}", file=sys.stderr)
        sys.exit(1)

    print("[wake_word] En écoute...", file=sys.stderr, flush=True)

    # Cooldown : évite les détections en rafale sur le même mot
    cooldown_chunks = int(SAMPLE_RATE / CHUNK * 1.5)  # ~1.5s
    cooldown = 0

    try:
        while True:
            try:
                data = stream.read(CHUNK, exception_on_overflow=False)
            except OSError as e:
                print(f"[wake_word] Erreur lecture audio : {e}", file=sys.stderr)
                continue

            audio = np.frombuffer(data, dtype=np.int16)
            prediction = oww.predict(audio)

            if cooldown > 0:
                cooldown -= 1
                continue

            for model_name, score in prediction.items():
                if score >= args.threshold:
                    print("DETECTED", flush=True)
                    cooldown = cooldown_chunks
                    break

    except KeyboardInterrupt:
        pass
    finally:
        stream.stop_stream()
        stream.close()
        pa.terminate()

if __name__ == "__main__":
    main()
