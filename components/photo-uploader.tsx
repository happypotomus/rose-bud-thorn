'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, Image as ImageIcon } from 'lucide-react'

type PhotoUploaderProps = {
  onPhotoUploaded: (url: string, caption: string) => void
  onDiscard: () => void
  existingPhotoUrl?: string | null
  existingCaption?: string | null
  userId: string
  weekId: string
}

export function PhotoUploader({
  onPhotoUploaded,
  onDiscard,
  existingPhotoUrl,
  existingCaption,
  userId,
  weekId,
}: PhotoUploaderProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(existingPhotoUrl || null)
  const [caption, setCaption] = useState<string>(existingCaption || '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, WebP, or GIF)')
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be less than 5MB. Please choose a smaller file.')
      return
    }

    setError(null)
    setUploading(true)

    // Create preview
    const previewUrl = URL.createObjectURL(file)
    setPhotoUrl(previewUrl)

    try {
      // Generate unique filename
      const timestamp = Date.now()
      const fileExtension = file.name.split('.').pop() || 'jpg'
      const filePath = `${userId}/${weekId}/photo_${timestamp}.${fileExtension}`

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath)

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL')
      }

      // Revoke preview URL
      URL.revokeObjectURL(previewUrl)

      setPhotoUrl(urlData.publicUrl)
      setUploading(false)
      onPhotoUploaded(urlData.publicUrl, caption)
    } catch (err) {
      console.error('Error uploading photo:', err)
      setError('We couldn\'t upload your photo. Please try again.')
      setUploading(false)
      setPhotoUrl(null)
      URL.revokeObjectURL(previewUrl)
    }
  }

  const handleCaptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCaption = e.target.value
    setCaption(newCaption)
    // Update parent if photo already uploaded
    if (photoUrl) {
      onPhotoUploaded(photoUrl, newCaption)
    }
  }

  const handleDiscard = () => {
    if (photoUrl && !existingPhotoUrl) {
      // If it's a preview URL, revoke it
      if (photoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photoUrl)
      }
    }
    setPhotoUrl(null)
    setCaption('')
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onDiscard()
  }

  const handleChooseFile = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="w-full space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {!photoUrl ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleChooseFile}
            disabled={uploading}
            className="w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-rose hover:bg-rose/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose"></div>
                <span className="text-gray-600">Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-gray-600 font-medium">Choose Photo</span>
                <span className="text-sm text-gray-500">JPEG, PNG, WebP, or GIF (max 5MB)</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <img
              src={photoUrl}
              alt="Preview"
              className="w-full max-w-md mx-auto rounded-lg border border-gray-200"
            />
            <button
              type="button"
              onClick={handleDiscard}
              className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
              title="Remove photo"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleChooseFile}
            disabled={uploading}
            className="text-sm text-rose hover:text-rose-dark font-medium disabled:opacity-50"
          >
            Change Photo
          </button>
        </div>
      )}

      {photoUrl && (
        <div>
          <label htmlFor="photo-caption" className="block text-sm font-medium text-gray-700 mb-2">
            Caption (optional)
          </label>
          <input
            id="photo-caption"
            type="text"
            value={caption}
            onChange={handleCaptionChange}
            placeholder="Add a caption..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose focus:border-transparent text-base"
          />
        </div>
      )}

      {error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}
    </div>
  )
}
