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
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressRef = useRef<HTMLDivElement | null>(null)

  // Audio player setup - only recreate when audioUrl or state changes, not playbackRate
  useEffect(() => {
    if (audioUrl && state === 'uploaded') {
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.playbackRate = playbackRate

      const updateTime = () => {
        // CRITICAL FIX: Use audioRef.current instead of closure variable
        const currentAudio = audioRef.current
        if (currentAudio && !isNaN(currentAudio.currentTime)) {
          setCurrentTime(currentAudio.currentTime)
        }
      }
      const updateDuration = () => {
        const currentAudio = audioRef.current
        if (currentAudio && !isNaN(currentAudio.duration) && currentAudio.duration > 0) {
          setDuration(currentAudio.duration)
        }
      }
      const handleEnded = () => {
        setIsPlaying(false)
        setCurrentTime(0)
      }
      const handlePlay = () => setIsPlaying(true)
      const handlePause = () => setIsPlaying(false)

      // Update time more frequently for smoother progress bar
      const timeInterval = setInterval(updateTime, 50)
      
      audio.addEventListener('loadedmetadata', updateDuration)
      audio.addEventListener('ended', handleEnded)
      audio.addEventListener('play', handlePlay)
      audio.addEventListener('pause', handlePause)
      audio.addEventListener('timeupdate', updateTime)

      // Load metadata immediately
      audio.load()

      return () => {
        clearInterval(timeInterval)
        audio.removeEventListener('timeupdate', updateTime)
        audio.removeEventListener('loadedmetadata', updateDuration)
        audio.removeEventListener('ended', handleEnded)
        audio.removeEventListener('play', handlePlay)
        audio.removeEventListener('pause', handlePause)
        audio.pause()
        audioRef.current = null
      }
    }
  }, [audioUrl, state])

  // Update playback rate on existing audio element without recreating it
  useEffect(() => {
    if (audioRef.current && state === 'uploaded') {
      const wasPlaying = !audioRef.current.paused
      audioRef.current.playbackRate = playbackRate
      // If audio was playing, ensure it continues playing after rate change
      if (wasPlaying && audioRef.current.paused) {
        audioRef.current.play().catch(err => {
          console.error('Error playing audio after speed change:', err)
        })
      }
    }
  }, [playbackRate, state])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (audioUrl && !existingAudioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl, existingAudioUrl])

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play().catch(err => {
          console.error('Error playing audio:', err)
        })
      }
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && progressRef.current && duration > 0) {
      const rect = progressRef.current.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const percentage = Math.max(0, Math.min(1, clickX / rect.width))
      const newTime = percentage * duration
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const handlePlaybackSpeedChange = () => {
    const newRate = playbackRate === 1 ? 1.5 : 1
    setPlaybackRate(newRate)
    // The useEffect will handle updating the playback rate and maintaining playback state
  }

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
      if (!isPlaying) {
        audioRef.current.play().catch(err => {
          console.error('Error playing audio:', err)
        })
      }
    }
  }

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

  // Recording state - animated red button with concentric circles, keep microphone icon
  if (state === 'recording') {
    return (
      <div className="relative flex items-center justify-center">
        {/* Concentric circles animation - smaller, extending just a bit outside button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] rounded-full bg-red-600/30 recording-circle recording-circle-1" />
          <div className="absolute w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] rounded-full bg-red-600/20 recording-circle recording-circle-2" />
          <div className="absolute w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] rounded-full bg-red-600/10 recording-circle recording-circle-3" />
        </div>
        
        {/* Red recording button with microphone icon */}
        <button
          onClick={stopRecording}
          className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700 transition-colors touch-manipulation z-10"
          aria-label="Stop recording"
        >
          <svg
            className="w-6 h-6 sm:w-8 sm:h-8 text-white"
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

  // Uploaded/Recorded state - show recorded visual with progress bar
  if (state === 'uploaded' && audioUrl) {
    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0
    
    return (
      <div className="w-full max-w-md">
        <div className="p-3 sm:p-4 border border-gray-300 rounded-lg bg-white space-y-3">
          {/* Top row: Play/Pause button + Restart + "Recorded" text + Playback speed + Delete icon */}
          <div className="flex items-center justify-between">
            {/* Left side: Play/Pause button + Restart + "Recorded" text */}
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayPause}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
                aria-label={isPlaying ? "Pause recording" : "Play recording"}
              >
                {isPlaying ? (
                  <svg
                    className="w-5 h-5 text-gray-700"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 text-gray-700"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleRestart}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Restart from beginning"
              >
                <svg
                  className="w-5 h-5 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              <span className="text-sm sm:text-base text-gray-600 ml-1">Recorded</span>
            </div>
            
            {/* Right side: Playback speed + Delete icon */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlaybackSpeedChange}
                className="px-2 py-1 text-xs sm:text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                aria-label={`Playback speed: ${playbackRate}x`}
              >
                {playbackRate}x
              </button>
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
          
          {/* Progress bar - clickable to scrub */}
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            onMouseDown={(e) => {
              if (progressRef.current && duration > 0) {
                const rect = progressRef.current.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const percentage = Math.max(0, Math.min(1, clickX / rect.width))
                const newTime = percentage * duration
                if (audioRef.current) {
                  audioRef.current.currentTime = newTime
                  setCurrentTime(newTime)
                }
              }
            }}
            className="w-full h-2 bg-gray-200 rounded-full cursor-pointer relative touch-manipulation"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
          >
            <div
              className="h-full bg-rose rounded-full transition-all duration-100"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          
          {/* Time display */}
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatTime(Math.floor(currentTime))}</span>
            <span>{duration > 0 ? formatTime(Math.floor(duration)) : '--:--'}</span>
          </div>
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
