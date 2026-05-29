# Tokenizer microservice for Llama 3, Qwen, Mistral
# FastAPI server: POST /count_tokens { model, text }


import asyncio
import subprocess

from fastapi import FastAPI
from pydantic import BaseModel
from typing import Literal
import signal
import uvicorn
import logging
from logging.handlers import RotatingFileHandler
import os

# Logger setup
LOG_PATH = "/data/assistant/apps/desktop/logs/tokenizer_server.log"
logger = logging.getLogger("tokenizer_server")
logger.setLevel(logging.INFO)
handler = RotatingFileHandler(LOG_PATH, maxBytes=1_000_000, backupCount=3, encoding="utf-8")
formatter = logging.Formatter("[%(levelname)s] %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)

def log_info(msg):
    logger.info(msg)

def log_error(msg):
    logger.error(msg)

app = FastAPI()


# --- Tokenizers HuggingFace pour Llama 3, Mistral, Qwen ---
try:
    from transformers import AutoTokenizer
    llama3_tokenizer = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B")
    log_info("Llama 3 tokenizer loaded successfully.")
    mistral_tokenizer = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-Instruct-v0.2")
    log_info("Mistral tokenizer loaded successfully.")
    qwen_tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen1.5-7B-Chat")
    log_info("Qwen tokenizer loaded successfully.")
    HAS_TOKENIZERS = True
except ImportError:
    llama3_tokenizer = None
    mistral_tokenizer = None
    qwen_tokenizer = None
    HAS_TOKENIZERS = False
    log_error("transformers library not installed. Token counting will not work.")
except Exception as e:
    llama3_tokenizer = None
    mistral_tokenizer = None
    qwen_tokenizer = None
    HAS_TOKENIZERS = False
    log_error(f"Tokenizer loading error: {e}")

class TokenCountRequest(BaseModel):
    model: Literal["llama3", "qwen", "mistral"]
    text: str

@app.post("/count_tokens")
def count_tokens(req: TokenCountRequest):
    if not HAS_TOKENIZERS:
        return {"error": "transformers or tokenizers not available"}
    if req.model == "llama3":
        if llama3_tokenizer is None:
            return {"error": "Llama 3 tokenizer not available"}
        tokens = llama3_tokenizer.encode(req.text)
        log_info(f"Counted {len(tokens)} tokens for Llama 3 (transformers)")
        return {"tokens": len(tokens)}
    elif req.model == "mistral":
        if mistral_tokenizer is None:
            return {"error": "Mistral tokenizer not available"}
        tokens = mistral_tokenizer.encode(req.text)
        log_info(f"Counted {len(tokens)} tokens for Mistral (transformers)")
        return {"tokens": len(tokens)}
    elif req.model == "qwen":
        if qwen_tokenizer is None:
            return {"error": "Qwen tokenizer not available"}
        tokens = qwen_tokenizer.encode(req.text)
        log_info(f"Counted {len(tokens)} tokens for Qwen (transformers)")
        return {"tokens": len(tokens)}
    else:
        return {"error": "Unknown model"}

async def main():
    import socket

    port = 8123
    skip = False
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
        if not pids:
            log_info(f"Port {port} is free")
            skip = True
        else:
            log_info(f"Cleaning up port {port}, killing pids: {pids}")
            for pid in pids:

                log_info(
                    f"Killing process {pid}"
                )

                os.kill(
                    pid,
                    signal.SIGKILL
                )


    except Exception as e:

        log_error(f"Could not cleanup port: {e}")

    if not skip:
        for _ in range(10):
            if skip:
                break
            with socket.socket(
                socket.AF_INET,
                socket.SOCK_STREAM
            ) as s:

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
                    if not pids:
                        log_info(f"Port {port} is free")
                        skip = True
                    else:
                        log_info(f"Cleaning up port {port}, killing pids: {pids}")
                        for pid in pids:

                            log_info(
                                f"Killing process {pid}"
                            )

                            os.kill(
                                pid,
                                signal.SIGKILL
                            )


                except Exception as e:
                    await asyncio.sleep(1)


        else:

            raise RuntimeError(
                f"Port {port} still busy"
            )

    server = uvicorn.Server(
        uvicorn.Config(
            host="0.0.0.0",
            port=8123,
            app=app,
            log_level="info",
            workers=1,
        )
    )
    print("TOKENIZER SERVER STARTED", flush=True)
    log_info("Tokenizer server started on port 8123")
    await server.serve()


asyncio.run(main())
                
