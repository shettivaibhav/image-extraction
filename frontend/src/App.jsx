import { useState } from 'react'
import ImageExtractor from './components/ImageExtractor'
import Header from './components/Header'
import ImageUploader from './components/ImageUploader'
import Toast from './components/Toast'

function App() {
  const [imageSrc, setImageSrc] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [toast, setToast] = useState({ message: '', visible: false })

  const showToast = (message) => {
    setToast({ message, visible: true })
    setTimeout(() => setToast({ message: '', visible: false }), 3000)
  }

  const handleImageSelected = (file) => {
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImageSrc(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleReset = () => {
    setImageSrc(null)
    setImageFile(null)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col items-center px-4 pb-12">
        {!imageSrc ? (
          <ImageUploader onImageSelected={handleImageSelected} />
        ) : (
          <ImageExtractor
            imageSrc={imageSrc}
            imageFile={imageFile}
            onReset={handleReset}
            showToast={showToast}
          />
        )}
      </main>

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  )
}

export default App
