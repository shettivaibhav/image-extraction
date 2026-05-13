# AI-Based Interactive Object Extraction

> **Smart Subject Lift** — Extract any object from an image with a long press, powered by SAM (Segment Anything Model).

## Project Structure

```
image extraction/
├── frontend/          # React + Tailwind CSS UI
├── backend/           # Local FastAPI proxy server
└── kaggle_notebook/   # SAM model notebook for Kaggle GPU
    └── sam_backend.ipynb
```

## Quick Start

### 1. Start the Kaggle Notebook (AI Backend)

1. Go to [Kaggle](https://www.kaggle.com/) → **New Notebook**
2. Upload `kaggle_notebook/sam_backend.ipynb`
3. Enable **GPU** in Notebook Settings (Accelerator → GPU T4 x2)
4. Get your **ngrok auth token** from https://dashboard.ngrok.com/get-started/your-authtoken
5. Paste the token in the notebook cell marked `NGROK_AUTH_TOKEN`
6. **Run All Cells** — copy the printed ngrok URL

### 2. Configure the Local Backend

1. Open `backend/.env`
2. Set: `KAGGLE_API_URL=https://your-ngrok-url.ngrok-free.app`

### 3. Start the Local Backend

```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## How to Use

1. Upload an image (drag & drop, click, or use camera)
2. **Long press** (hold ~0.5 seconds) on any object in the image
3. The AI extracts the object as a transparent cutout
4. **Drag** the extracted sticker around the image
5. **Download** the transparent PNG

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite 5, Tailwind CSS 3, Axios |
| Backend (local) | FastAPI, Python, OpenCV, Pillow |
| AI Model | Segment Anything Model (SAM ViT-B) |
| GPU | Kaggle (free Tesla T4/P100) |
| Tunneling | ngrok |
