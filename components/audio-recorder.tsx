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

type RecordingState = 'idle' | 'recording' | 'uploading' | 'uploaded' | 'error'

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

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setState('uploading')
        setRecordingTime(0)
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
        
        // Auto-upload immediately
        await uploadAudio(blob)
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

  const uploadAudio = async (blobToUpload?: Blob) => {
    const blob = blobToUpload || audioBlob
    if (!blob || !userId || !weekId) return

    setState('uploading')
    setError(null)

    try {
      const supabase = createClient()
      
      // Generate unique filename
      const timestamp = Date.now()
      const filePath = `${userId}/${weekId}/${section}_${timestamp}.webm`

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filePath, blob, {
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

  // Idle state - circular white button with grey border
  if (state === 'idle') {
    return (
      <button
        onClick={startRecording}
        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors touch-manipulation"
        aria-label="Start recording"
      >
        <svg
          className="w-6 h-6 sm:w-8 sm:h-8 text-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      </button>
    )
  }

  // Recording state - animated red button with concentric circles
  if (state === 'recording') {
    return (
      <div className="relative flex items-center justify-center">
        {/* Concentric circles animation */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600/30 recording-circle recording-circle-1" />
          <div className="absolute w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600/20 recording-circle recording-circle-2" />
          <div className="absolute w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600/10 recording-circle recording-circle-3" />
        </div>
        
        {/* Red recording button */}
        <button
          onClick={stopRecording}
          className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700 transition-colors touch-manipulation z-10"
          aria-label="Stop recording"
        >
          <svg
            className="w-6 h-6 sm:w-8 sm:h-8 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v6a1 1 0 11-2 0V7zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V7a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    )
  }

  // Uploading state
  if (state === 'uploading') {
    return (
      <div className="flex items-center justify-center gap-2 text-rose">
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
        <span className="text-sm">Uploading...</span>
      </div>
    )
  }

  // Uploaded/Recorded state - show recorded visual
  if (state === 'uploaded' && audioUrl) {
    return (
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between p-3 sm:p-4 border border-gray-300 rounded-lg bg-white">
          {/* Left side: Play button + "Recorded" text */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const audio = new Audio(audioUrl)
                audio.play()
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Play recording"
            >
              <svg
                className="w-5 h-5 text-gray-700"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </button>
            <span className="text-sm sm:text-base text-gray-600">Recorded</span>
          </div>
          
          {/* Right side: Delete icon */}
          <button
            onClick={handleDiscard}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-red-50 transition-colors"
            aria-label="Delete recording"
          >
            <svg
              className="w-5 h-5 text-gray-700 hover:text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // Error state
  if (state === 'error' && error) {
    return (
      <div className="w-full max-w-md space-y-3">
        <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => uploadAudio()}
            className="px-4 py-2 bg-rose text-white rounded-md hover:bg-rose-dark text-sm font-medium transition-colors"
          >
            Retry Upload
          </button>
          <button
            onClick={handleDiscard}
            className="px-4 py-2 border-2 border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium"
          >
            Discard
          </button>
        </div>
      </div>
    )
  }

  return null
}
