import { useEffect, useRef, useState, useCallback } from 'react'

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async (deviceId) => {
    setLoading(true)
    setError(null)
    stopCamera()

    const constraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: 'environment' }, // Default to back camera on mobile
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setLoading(false)

      // Enumerate cameras after permission is granted
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const allDevices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = allDevices.filter((d) => d.kind === 'videoinput')
        setDevices(videoDevices)
        
        // Match currently running track's device ID
        const activeTrack = stream.getVideoTracks()[0]
        if (activeTrack) {
          const settings = activeTrack.getSettings()
          if (settings.deviceId) {
            setSelectedDeviceId(settings.deviceId)
          }
        }
      }
    } catch (err) {
      console.error('Error accessing camera:', err)
      setLoading(false)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Permission denied. Please grant camera access in your browser settings.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera device found on this system.')
      } else {
        setError(`Failed to open camera: ${err.message}`)
      }
    }
  }, [stopCamera])

  // Start camera on mount
  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
  }, [startCamera, stopCamera])

  // Handle device change
  const handleDeviceChange = (e) => {
    const devId = e.target.value
    setSelectedDeviceId(devId)
    startCamera(devId)
  }

  // Capture current video frame
  const handleCapture = () => {
    const video = videoRef.current
    if (!video || !streamRef.current) return

    const width = video.videoWidth
    const height = video.videoHeight
    if (width === 0 || height === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    // Draw mirrored if using front camera (optional, but standard getUserMedia video does not mirror output, so we match it)
    ctx.drawImage(video, 0, 0, width, height)

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' })
          onCapture(file)
        }
      },
      'image/jpeg',
      0.95
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-xl overflow-hidden glass relative flex flex-col"
        style={{
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            📸 Take a Photo
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Camera Feed Area */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden border-b border-white/10">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950">
              <div className="spinner" />
              <p className="text-sm text-neutral-400">Initializing camera...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-4 bg-neutral-950">
              <span className="text-4xl">⚠️</span>
              <p className="text-sm font-medium text-red-400 max-w-sm">{error}</p>
              <button 
                onClick={() => startCamera(selectedDeviceId)}
                className="btn-primary py-2 px-4 text-xs font-semibold"
              >
                🔄 Retry Connection
              </button>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${loading || error ? 'hidden' : 'block'}`}
          />
        </div>

        {/* Controls Panel */}
        <div className="p-6 flex flex-col gap-4 bg-neutral-900/50">
          {/* Camera Selection Dropdown */}
          {devices.length > 1 && (
            <div className="flex items-center gap-3">
              <label htmlFor="camera-select" className="text-xs font-semibold text-neutral-400 whitespace-nowrap">
                Select Camera:
              </label>
              <select
                id="camera-select"
                value={selectedDeviceId}
                onChange={handleDeviceChange}
                className="w-full text-sm bg-neutral-950 text-white rounded-lg border border-white/10 p-2 focus:outline-none focus:border-[#6c5ce7]"
              >
                {devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-white/10 text-white/80 text-sm font-semibold hover:bg-white/5 hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleCapture}
              disabled={loading || !!error}
              className="flex-1 btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              📷 Capture Image
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
