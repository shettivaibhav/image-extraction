"""
Local FastAPI proxy server.
Receives image + (x, y) coordinates from the React frontend,
forwards to the Kaggle SAM backend, and returns the transparent PNG.
"""

import os
import io
import logging

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Use override=True so that if you update the .env file, it picks up the new URL on hot-reload
load_dotenv(override=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Smart Subject Lift — Proxy")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    load_dotenv(override=True)
    kaggle_url = os.getenv("KAGGLE_API_URL", "")
    return {
        "status": "ok",
        "kaggle_url_configured": bool(kaggle_url),
    }


@app.post("/api/segment")
async def segment(
    image: UploadFile = File(...),
    x: float = Form(...),
    y: float = Form(...),
):
    """
    Receive an image and normalised click coordinates (0‑1),
    forward to the Kaggle SAM endpoint, and return the cutout PNG.
    """
    load_dotenv(override=True)
    kaggle_url = os.getenv("KAGGLE_API_URL", "")
    if not kaggle_url:
        raise HTTPException(
            status_code=503,
            detail="KAGGLE_API_URL is not configured. "
            "Start the Kaggle notebook and set the ngrok URL in .env",
        )

    logger.info(f"Segmentation request: x={x:.4f}, y={y:.4f}, file={image.filename}")

    try:
        image_bytes = await image.read()

        # Forward to Kaggle
        resp = requests.post(
            f"{kaggle_url.rstrip('/')}/segment",
            files={"image": (image.filename, image_bytes, image.content_type)},
            data={"x": str(x), "y": str(y)},
            headers={"ngrok-skip-browser-warning": "true"},
            timeout=120,
        )

        if resp.status_code != 200 or "text/html" in resp.headers.get("Content-Type", ""):
            logger.error(f"Kaggle responded with {resp.status_code}: {resp.text[:200]}")
            # If the response contains ngrok warning/error signs, or is a gateway error
            if "ngrok" in resp.text.lower() or resp.status_code in [404, 502, 503, 504]:
                raise HTTPException(
                    status_code=503,
                    detail="Kaggle notebook/ngrok tunnel is offline. Please make sure the Kaggle notebook is running and KAGGLE_API_URL in backend/.env is updated."
                )
            raise HTTPException(status_code=502, detail="Kaggle segmentation failed")

        return StreamingResponse(
            io.BytesIO(resp.content),
            media_type="image/png",
            headers={"Content-Disposition": "attachment; filename=cutout.png"},
        )

    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=503,
            detail="Cannot reach Kaggle backend. Is the notebook running?",
        )
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Kaggle backend timed out.",
        )
