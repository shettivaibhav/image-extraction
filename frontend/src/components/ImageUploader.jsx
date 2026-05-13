import { useRef, useState, useCallback } from 'react'

export default function ImageUploader({ onImageSelected }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(
    (file) => {
      if (file && file.type.startsWith('image/')) {
        onImageSelected(file)
      }
    },
    [onImageSelected]
  )

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      handleFile(file)
    },
    [handleFile]
  )

  const handleChange = useCallback(
    (e) => {
      const file = e.target.files[0]
      handleFile(file)
    },
    [handleFile]
  )

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl mx-auto mt-8">
      {/* Instruction */}
      <div className="text-center mb-8">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
          Extract <span className="gradient-text">Any Object</span>
        </h2>
        <p
          className="text-base sm:text-lg max-w-md mx-auto leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          Upload an image, then <strong style={{ color: 'var(--text-primary)' }}>long press</strong> on any
          object to lift it out — just like on iPhone.
        </p>
      </div>

      {/* Dropzone */}
      <div
        id="image-dropzone"
        className={`dropzone w-full p-12 flex flex-col items-center gap-5 ${
          dragOver ? 'drag-over' : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {/* Upload icon */}
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl transition-smooth"
          style={{
            background: 'rgba(108, 92, 231, 0.1)',
            border: '1px solid rgba(108, 92, 231, 0.2)',
          }}
        >
          📷
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold mb-1">
            Drop your image here
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            or click to browse • PNG, JPG, WEBP
          </p>
        </div>

        <button className="btn-primary mt-2" type="button">
          Choose Image
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
          id="image-file-input"
        />
      </div>

      {/* Camera capture on mobile */}
      <button
        className="mt-4 flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-xl transition-smooth"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--text-secondary)',
        }}
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/*'
          input.capture = 'environment'
          input.onchange = (e) => handleFile(e.target.files[0])
          input.click()
        }}
        id="camera-capture-btn"
      >
        📸 Capture with Camera
      </button>
    </div>
  )
}
