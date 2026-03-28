import { useState, useRef } from 'react'
import { XMarkIcon } from '@heroicons/react/20/solid'
import { Avatar } from './catalyst/avatar'
import { Button } from './catalyst/button'

interface ImageUploadProps {
  currentImageUrl?: string | null
  initials: string
  onUpload: (file: File) => void
  isUploading: boolean
  error?: string | null
  square?: boolean
  label?: string
  description?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

export function ImageUpload({
  currentImageUrl,
  initials,
  onUpload,
  isUploading,
  error,
  square = false,
  label = 'Profile Picture',
  description = 'Click to upload a new image. JPG, PNG, WebP, or GIF. Max 10MB.',
}: ImageUploadProps) {
  const [localError, setLocalError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayError = error || localError

  const validateAndUpload = (file: File) => {
    setLocalError(null)

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setLocalError('Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.')
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setLocalError('File is too large. Maximum size is 10MB.')
      return
    }

    onUpload(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndUpload(file)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      validateAndUpload(file)
    }
  }

  const dismissError = () => {
    setLocalError(null)
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        className={`relative inline-block cursor-pointer group ${isDragging ? 'opacity-50' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={isUploading}
      >
        <Avatar
          src={currentImageUrl}
          initials={initials}
          square={square}
          className="size-24"
        />
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
          <span className="text-white text-sm font-medium">
            {isUploading ? 'Uploading...' : currentImageUrl ? 'Replace' : 'Upload'}
          </span>
        </div>

        {/* Loading spinner overlay */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full">
            <div className="size-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={handleFileChange}
          disabled={isUploading}
          className="hidden"
        />
      </button>

      <div className="space-y-2">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
        
        {displayError && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-300">
            <span className="flex-1">{displayError}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                dismissError()
              }}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
            >
              <XMarkIcon className="size-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
