import { useState, useRef, useCallback, useEffect } from 'react'
import axios from 'axios'

const LONG_PRESS_MS = 500

export default function ImageExtractor({ imageSrc, imageFile, onReset, showToast }) {
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const pressTimer = useRef(null)
  const pressStartPos = useRef(null)

  const [processing, setProcessing] = useState(false)
  const [pressIndicator, setPressIndicator] = useState(null) // { x, y }
  const [cutout, setCutout] = useState(null) // { url, x, y, width, height }
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // ─── Long-press handlers ───
  const getRelativeCoords = useCallback((e) => {
    const rect = imgRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      relX: (clientX - rect.left) / rect.width,
      relY: (clientY - rect.top) / rect.height,
    }
  }, [])

  const handlePointerDown = useCallback(
    (e) => {
      if (processing) return
      e.preventDefault()
      const coords = getRelativeCoords(e)
      pressStartPos.current = coords

      // Show progress indicator
      setPressIndicator({ x: coords.x, y: coords.y })

      pressTimer.current = setTimeout(() => {
        // Long press triggered!
        setPressIndicator(null)
        triggerSegmentation(coords)
      }, LONG_PRESS_MS)
    },
    [processing, getRelativeCoords]
  )

  const handlePointerUp = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    setPressIndicator(null)
  }, [])

  const handlePointerMove = useCallback(
    (e) => {
      // Cancel long-press if finger/mouse moved too much
      if (pressTimer.current && pressStartPos.current) {
        const coords = getRelativeCoords(e)
        const dx = coords.x - pressStartPos.current.x
        const dy = coords.y - pressStartPos.current.y
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
          clearTimeout(pressTimer.current)
          pressTimer.current = null
          setPressIndicator(null)
        }
      }
    },
    [getRelativeCoords]
  )

  // ─── Segmentation API call ───
  const triggerSegmentation = useCallback(
    async (coords) => {
      setProcessing(true)
      try {
        const formData = new FormData()
        formData.append('image', imageFile)
        // Send normalised coordinates (0-1)
        formData.append('x', coords.relX.toFixed(4))
        formData.append('y', coords.relY.toFixed(4))

        const response = await axios.post('/api/segment', formData, {
          responseType: 'blob',
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        })

        const cutoutUrl = URL.createObjectURL(response.data)

        // Load the cutout to get its natural size for proper sizing
        const img = new Image()
        img.onload = () => {
          const containerRect = containerRef.current.getBoundingClientRect()
          const imgRect = imgRef.current.getBoundingClientRect()
          // Scale cutout to fit nicely – cap at 60% of the displayed image size
          const maxW = imgRect.width * 0.6
          const maxH = imgRect.height * 0.6
          const scale = Math.min(maxW / img.width, maxH / img.height, 1)
          const w = img.width * scale
          const h = img.height * scale

          // Position near the press point
          const offsetX = imgRect.left - containerRect.left
          const offsetY = imgRect.top - containerRect.top
          setCutout({
            url: cutoutUrl,
            x: offsetX + coords.x - w / 2,
            y: offsetY + coords.y - h / 2,
            width: w,
            height: h,
          })
          showToast('✨ Object extracted! Drag it around or download.')
        }
        img.src = cutoutUrl
      } catch (err) {
        console.error('Segmentation failed:', err)
        let message = '❌ Segmentation failed. Please try again.'
        
        if (!err.response) {
          // Local FastAPI server is down/not responding
          message = '⚠️ Local backend server is not running. Please start it using start.bat.'
        } else if (err.response.status === 503) {
          // Specific 503 error details from backend (either missing URL or offline ngrok)
          message = err.response.data?.detail || '⚠️ Backend not connected. Start the Kaggle notebook first.'
        } else if (err.response.status === 502) {
          message = '❌ Kaggle segmentation failed. Check the Kaggle notebook logs.'
        } else if (err.response.status === 504) {
          message = '⏱️ Kaggle backend timed out. Try a smaller image or wait a moment.'
        } else if (err.response.data?.detail) {
          message = `❌ Error: ${err.response.data.detail}`
        }
        
        showToast(message)
      } finally {
        setProcessing(false)
      }
    },
    [imageFile, showToast]
  )

  // ─── Draggable sticker logic ───
  const handleStickerPointerDown = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    setDragging(true)
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const rect = e.currentTarget.getBoundingClientRect()
    dragOffset.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }, [])

  useEffect(() => {
    if (!dragging) return

    const handleMove = (e) => {
      e.preventDefault()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      const containerRect = containerRef.current.getBoundingClientRect()
      setCutout((prev) =>
        prev
          ? {
              ...prev,
              x: clientX - containerRect.left - dragOffset.current.x,
              y: clientY - containerRect.top - dragOffset.current.y,
            }
          : prev
      )
    }

    const handleUp = () => setDragging(false)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleUp)
    }
  }, [dragging])

  // ─── Download ───
  const downloadCutout = useCallback(() => {
    if (!cutout) return
    const a = document.createElement('a')
    a.href = cutout.url
    a.download = 'cutout.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    showToast('📥 Download started!')
  }, [cutout, showToast])

  // ─── Clear cutout ───
  const clearCutout = useCallback(() => {
    if (cutout?.url) URL.revokeObjectURL(cutout.url)
    setCutout(null)
  }, [cutout])

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-4xl mx-auto mt-4">
      {/* Toolbar */}
      <div className="toolbar flex-wrap justify-center">
        <button onClick={onReset} id="btn-new-image">
          🖼️ New Image
        </button>
        {cutout && (
          <>
            <button onClick={downloadCutout} id="btn-download">
              💾 Download PNG
            </button>
            <button onClick={clearCutout} id="btn-clear-cutout">
              🗑️ Clear Cutout
            </button>
          </>
        )}
      </div>

      {/* Hint */}
      {!cutout && !processing && (
        <p
          className="text-sm font-medium animate-pulse"
          style={{ color: 'var(--accent-end)' }}
        >
          👆 Long press on any object to extract it
        </p>
      )}

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="canvas-container relative"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerMove={handlePointerMove}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Source image */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Source"
          draggable={false}
          className="no-select"
          style={{ maxHeight: '70vh' }}
        />

        {/* Long-press progress indicator */}
        {pressIndicator && (
          <svg
            className="absolute pointer-events-none"
            width="80"
            height="80"
            style={{
              left: pressIndicator.x - 40,
              top: pressIndicator.y - 40,
            }}
            viewBox="0 0 80 80"
          >
            <circle
              cx="40"
              cy="40"
              r="30"
              fill="none"
              stroke="rgba(162, 155, 254, 0.2)"
              strokeWidth="3"
            />
            <circle
              cx="40"
              cy="40"
              r="30"
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="3"
              strokeLinecap="round"
              className="progress-ring-circle"
            />
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6c5ce7" />
                <stop offset="100%" stopColor="#00cec9" />
              </linearGradient>
            </defs>
          </svg>
        )}

        {/* Processing overlay */}
        {processing && (
          <div className="processing-overlay">
            <div className="spinner" />
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Extracting object…
            </p>
          </div>
        )}

        {/* Draggable cutout sticker */}
        {cutout && (
          <img
            src={cutout.url}
            alt="Extracted cutout"
            className="cutout-sticker"
            style={{
              left: cutout.x,
              top: cutout.y,
              width: cutout.width,
              height: cutout.height,
            }}
            draggable={false}
            onPointerDown={handleStickerPointerDown}
            onTouchStart={handleStickerPointerDown}
          />
        )}
      </div>

      {/* Before/After preview panel */}
      {cutout && (
        <div className="glass p-6 w-full max-w-md">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
            Extracted Object Preview
          </h3>
          <div className="checkerboard rounded-xl p-4 flex items-center justify-center">
            <img
              src={cutout.url}
              alt="Cutout preview"
              className="max-w-full max-h-48 object-contain"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}
            />
          </div>
          <button
            className="btn-primary w-full mt-4"
            onClick={downloadCutout}
            id="btn-download-preview"
          >
            ⬇️ Download Transparent PNG
          </button>
        </div>
      )}
    </div>
  )
}
