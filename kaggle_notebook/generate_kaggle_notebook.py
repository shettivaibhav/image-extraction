"""
Generates the Kaggle notebook (sam_backend.ipynb) that runs the SAM model,
serves a FastAPI endpoint, and tunnels it through ngrok.

Run:  python generate_kaggle_notebook.py
"""

import json

cells = []


def md(source):
    cells.append({"cell_type": "markdown", "metadata": {}, "source": source.split("\n")})


def code(source):
    cells.append(
        {
            "cell_type": "code",
            "metadata": {"trusted": True},
            "source": source.strip().split("\n"),
            "execution_count": None,
            "outputs": [],
        }
    )


# ── Title ──
md("# 🧠 SAM Segmentation Backend\n\nThis notebook loads the **Segment Anything Model (SAM)**, runs a **FastAPI** server, and exposes it via **ngrok** so your local React app can call it.\n\n> **GPU required** — select *Accelerator → GPU T4 x2* from the sidebar.")

# ── Cell 1: Install dependencies ──
code(
    """# Install dependencies
!pip install -q segment-anything fastapi uvicorn pyngrok python-multipart opencv-python-headless Pillow nest-asyncio"""
)

# ── Cell 2: Download SAM checkpoint ──
code(
    """# Download SAM ViT-B checkpoint (~375 MB)
import os
if not os.path.exists("sam_vit_b_01ec64.pth"):
    !wget -q https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth
    print("✅ SAM checkpoint downloaded")
else:
    print("✅ SAM checkpoint already exists")"""
)

# ── Cell 3: Load SAM model ──
code(
    """import torch
import numpy as np
from segment_anything import sam_model_registry, SamPredictor

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {DEVICE}")

sam = sam_model_registry["vit_b"](checkpoint="sam_vit_b_01ec64.pth")
sam.to(DEVICE)
predictor = SamPredictor(sam)
print("✅ SAM model loaded and ready")"""
)

# ── Cell 4: Set up ngrok ──
code(
    """# ─── Configure ngrok ───
# 1. Go to https://dashboard.ngrok.com/get-started/your-authtoken
# 2. Copy your auth token
# 3. Paste it below

NGROK_AUTH_TOKEN = "PASTE_YOUR_NGROK_TOKEN_HERE"

from pyngrok import ngrok
ngrok.set_auth_token(NGROK_AUTH_TOKEN)
print("✅ ngrok configured")"""
)

# ── Cell 5: FastAPI server + segmentation logic ──
code(
    """import io
import cv2
import nest_asyncio
from PIL import Image
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

nest_asyncio.apply()

app = FastAPI(title="SAM Segmentation API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def refine_mask(mask: np.ndarray) -> np.ndarray:
    \"\"\"Apply morphological operations and edge feathering for smoother edges.\"\"\"
    mask_uint8 = (mask * 255).astype(np.uint8)
    
    # Morphological close to fill small holes
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask_uint8 = cv2.morphologyEx(mask_uint8, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    # Slight dilation then Gaussian blur for feathered edges
    mask_uint8 = cv2.dilate(mask_uint8, kernel, iterations=1)
    mask_uint8 = cv2.GaussianBlur(mask_uint8, (7, 7), 0)
    
    return mask_uint8


@app.get("/health")
async def health():
    return {"status": "ok", "model": "sam_vit_b", "device": str(DEVICE)}


@app.post("/segment")
async def segment(
    image: UploadFile = File(...),
    x: float = Form(...),
    y: float = Form(...),
):
    \"\"\"
    Segment the object at normalised coordinates (x, y) in the uploaded image.
    Returns a transparent PNG of the extracted object.
    \"\"\"
    # Read image
    img_bytes = await image.read()
    img_array = np.frombuffer(img_bytes, np.uint8)
    img_bgr = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    
    h, w = img_rgb.shape[:2]
    
    # Convert normalised coords to pixel coords
    px = int(x * w)
    py = int(y * h)
    
    # Run SAM
    predictor.set_image(img_rgb)
    input_point = np.array([[px, py]])
    input_label = np.array([1])  # 1 = foreground
    
    masks, scores, _ = predictor.predict(
        point_coords=input_point,
        point_labels=input_label,
        multimask_output=True,
    )
    
    # Pick best mask
    best_idx = np.argmax(scores)
    mask = masks[best_idx]
    
    # Refine edges
    alpha = refine_mask(mask)
    
    # Create RGBA output
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = img_rgb
    rgba[:, :, 3] = alpha
    
    # Crop to bounding box of the mask for a tighter cutout
    ys, xs = np.where(alpha > 0)
    if len(ys) == 0:
        # Fallback: return full image if no mask found
        result_img = Image.fromarray(rgba)
    else:
        pad = 10
        y1, y2 = max(ys.min() - pad, 0), min(ys.max() + pad, h)
        x1, x2 = max(xs.min() - pad, 0), min(xs.max() + pad, w)
        cropped = rgba[y1:y2, x1:x2]
        result_img = Image.fromarray(cropped)
    
    # Encode as PNG
    buf = io.BytesIO()
    result_img.save(buf, format="PNG")
    buf.seek(0)
    
    return Response(content=buf.getvalue(), media_type="image/png")

print("✅ FastAPI app defined")"""
)

# ── Cell 6: Start server + ngrok tunnel ──
code(
    """import uvicorn
from pyngrok import ngrok

# Open tunnel
public_url = ngrok.connect(8000)
print(f"\\n{'='*60}")
print(f"🌐 PUBLIC URL: {public_url}")
print(f"{'='*60}")
print(f"\\n📋 Copy this URL and paste it into backend/.env as:\\n")
print(f"   KAGGLE_API_URL={public_url}")
print(f"\\n{'='*60}\\n")

# Run server (blocking)
uvicorn.run(app, host="0.0.0.0", port=8000)"""
)

# ── Build notebook JSON ──
notebook = {
    "nbformat": 4,
    "nbformat_minor": 4,
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3",
        },
        "language_info": {
            "name": "python",
            "version": "3.10.0",
        },
    },
    "cells": cells,
}

out_path = "sam_backend.ipynb"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(notebook, f, indent=1, ensure_ascii=False)

print(f"[OK] Generated {out_path}")
print("     Upload this file to Kaggle and run with GPU enabled.")
