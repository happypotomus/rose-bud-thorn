'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlowerLogo } from '@/components/flower-logo'

type Circle = {
  id: string
  name: string
}

type Reflection = {
  id: string
  rose_text: string | null
  bud_text: string | null
  thorn_text: string | null
  circle_id: string
  week_id: string
}

type ShareFormProps = {
  reflectionId: string
  originalCircleId: string
  circles: Circle[]
  reflection: Reflection
}

export function ShareForm({
  reflectionId,
  originalCircleId,
  circles,
  reflection,
}: ShareFormProps) {
  const router = useRouter()
  const [selectedCircles, setSelectedCircles] = useState<Set<string>>(
    new Set([originalCircleId]) // Pre-select the original circle
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleCircle = (circleId: string) => {
    setSelectedCircles((prev) => {
      const next = new Set(prev)
      if (next.has(circleId)) {
        next.delete(circleId)
      } else {
        next.add(circleId)
      }
      return next
    })
  }

  const handleShare = async () => {
    if (selectedCircles.size === 0) {
      setError('Please select at least one circle to share to.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/reflection/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reflectionId,
          circleIds: Array.from(selectedCircles),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to share reflection. Please try again.')
        setLoading(false)
        return
      }

      // Success - redirect to home (will default to first circle or use selected)
      router.push('/home')
    } catch (err) {
      console.error('Error sharing reflection:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const handleSkip = () => {
    router.push('/home')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:py-8 md:p-24 pt-safe pb-safe">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <FlowerLogo />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-4 sm:mt-6 text-center">
            Share Your Reflection
          </h1>
          <p className="text-base sm:text-lg text-gray-600 mt-2 text-center">
            Choose which circles to share this reflection with
          </p>
        </div>

        {/* Reflection Preview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Your Reflection</h2>
          <div className="space-y-4">
            {reflection.rose_text && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">🌹 Rose</h3>
                <p className="text-sm sm:text-base text-gray-600">{reflection.rose_text}</p>
              </div>
            )}
            {reflection.bud_text && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">🌱 Bud</h3>
                <p className="text-sm sm:text-base text-gray-600">{reflection.bud_text}</p>
              </div>
            )}
            {reflection.thorn_text && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">🌵 Thorn</h3>
                <p className="text-sm sm:text-base text-gray-600">{reflection.thorn_text}</p>
              </div>
            )}
          </div>
        </div>

        {/* Circle Selection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Select Circles</h2>
          <div className="space-y-3">
            {circles.map((circle) => (
              <label
                key={circle.id}
                className="flex items-center p-3 sm:p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedCircles.has(circle.id)}
                  onChange={() => toggleCircle(circle.id)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-3 sm:ml-4 text-base sm:text-lg text-gray-900">
                  {circle.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={handleSkip}
            disabled={loading}
            className="flex-1 px-6 py-3 sm:py-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-lg"
          >
            Skip
          </button>
          <button
            onClick={handleShare}
            disabled={loading || selectedCircles.size === 0}
            className="flex-1 px-6 py-3 sm:py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-lg"
          >
            {loading ? 'Sharing...' : `Share to ${selectedCircles.size} Circle${selectedCircles.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </main>
  )
}



