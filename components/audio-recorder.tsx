'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type AudioRecorderProps = {
  onAudioUploaded: (url: string) => void
  onDiscard: () => void
  existingAudioUrl?: string | null
  userId: string
  weekId: string
  section: 'rose' | 'bud' | 'thorn'
}

type RecordingState = 'idle' | 'recording' | 'stopped' | 'uploading' | 'uploaded' | 'error'

export function AudioRecorder({
  onAudioUploaded,
  onDiscard,
  existingAudioUrl,
  userId,
  weekId,
  section,
}: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>(
    existingAudioUrl ? 'uploaded' : 'idle'
  )
  const [error, setError] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(existingAudioUrl || null)
  const [recordingTime, setRecordingTime] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (audioUrl && !existingAudioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl, existingAudioUrl])

  const startRecording = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setState('stopped')
        setRecordingTime(0)
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
      }

      mediaRecorder.start()
      setState('recording')

      // Start timer
      let seconds = 0
      timerRef.current = setInterval(() => {
        seconds++
        setRecordingTime(seconds)
      }, 1000)
    } catch (err) {
      console.error('Error starting recording:', err)
      setError('Could not access microphone. Please check permissions.')
      setState('idle')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }

  const uploadAudio = async () => {
    if (!audioBlob || !userId || !weekId) return

    setState('uploading')
    setError(null)

    try {
      const supabase = createClient()
      
      // Generate unique filename
      // Path structure: {userId}/{weekId}/{section}_{timestamp}.webm
      // This matches the RLS policy that checks the first folder = userId
      const timestamp = Date.now()
      const filePath = `${userId}/${weekId}/${section}_${timestamp}.webm`

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
          upsert: false,
        })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('audio')
        .getPublicUrl(filePath)

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL')
      }

      setState('uploaded')
      setAudioUrl(urlData.publicUrl)
      onAudioUploaded(urlData.publicUrl)
    } catch (err) {
      console.error('Error uploading audio:', err)
      setError('We couldn\'t upload your audio. Please try again.')
      setState('error')
    }
  }

  const handleDiscard = () => {
    if (audioUrl && !existingAudioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioBlob(null)
    setAudioUrl(null)
    setState('idle')
    setError(null)
    onDiscard()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-5">
      {/* Recording controls */}
      {state === 'idle' && (
        <button
          onClick={startRecording}
          className="flex items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto px-6 sm:px-5 py-3 sm:py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-base sm:text-sm font-medium"
        >
          <svg
            className="w-5 h-5 sm:w-4 sm:h-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
              clipRule="evenodd"
            />
          </svg>
          Record
        </button>
      )}

      {state === 'recording' && (
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-600 rounded-full animate-pulse" />
            <span className="font-mono text-lg sm:text-xl font-semibold">{formatTime(recordingTime)}</span>
          </div>
          <button
            onClick={stopRecording}
            className="w-full sm:w-auto px-6 sm:px-5 py-3 sm:py-2.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-base sm:text-sm font-medium"
          >
            Stop
          </button>
        </div>
      )}

      {/* Preview and upload */}
      {state === 'stopped' && audioUrl && (
        <div className="space-y-4 sm:space-y-3">
          <audio src={audioUrl} controls className="w-full" />
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
            <button
              onClick={uploadAudio}
              className="w-full sm:w-auto px-6 sm:px-4 py-3 sm:py-2 bg-rose text-white rounded-md hover:bg-rose-dark active:bg-rose-dark text-base sm:text-sm font-medium transition-colors"
            >
              Keep & Upload
            </button>
            <button
              onClick={handleDiscard}
              className="w-full sm:w-auto px-6 sm:px-4 py-3 sm:py-2 border-2 border-gray-300 rounded-md hover:bg-gray-50 text-base sm:text-sm font-medium"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Uploading state */}
      {state === 'uploading' && (
        <div className="flex items-center gap-2 text-blue-600">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Uploading...</span>
        </div>
      )}

      {/* Uploaded state */}
      {state === 'uploaded' && audioUrl && (
        <div className="space-y-4 sm:space-y-3">
          <div className="flex items-center gap-2 sm:gap-2 text-green-600">
            <svg
              className="w-5 h-5 sm:w-4 sm:h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-base sm:text-sm font-medium">Audio uploaded</span>
          </div>
          <audio src={audioUrl} controls className="w-full" />
          <button
            onClick={handleDiscard}
            className="w-full sm:w-auto px-6 sm:px-4 py-3 sm:py-2 border-2 border-gray-300 rounded-md hover:bg-gray-50 text-base sm:text-sm font-medium"
          >
            Remove Audio
          </button>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && error && (
        <div className="space-y-4 sm:space-y-3">
          <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded text-sm sm:text-base">
            {error}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
            <button
              onClick={uploadAudio}
              className="w-full sm:w-auto px-6 sm:px-4 py-3 sm:py-2 bg-rose text-white rounded-md hover:bg-rose-dark active:bg-rose-dark text-base sm:text-sm font-medium transition-colors"
            >
              Retry Upload
            </button>
            <button
              onClick={handleDiscard}
              className="w-full sm:w-auto px-6 sm:px-4 py-3 sm:py-2 border-2 border-gray-300 rounded-md hover:bg-gray-50 text-base sm:text-sm font-medium"
            >
              Discard Recording
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


