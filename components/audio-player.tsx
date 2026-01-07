'use client'

import { useRef, useState, useEffect } from 'react'

type AudioPlayerProps = {
  src: string
  className?: string
}

export function AudioPlayer({ src, className = 'w-full' }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)

  const speedOptions = [0.75, 1, 1.25, 1.5, 1.75, 2]

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed)
    setShowSpeedMenu(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <audio ref={audioRef} src={src} controls className={className} />
        <div className="relative">
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 transition-colors"
            title="Playback speed"
          >
            {playbackRate}x
          </button>
          {showSpeedMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowSpeedMenu(false)}
              />
              <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 min-w-[80px]">
                {speedOptions.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-100 first:rounded-t-md last:rounded-b-md ${
                      playbackRate === speed ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

