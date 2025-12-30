'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { FlowerLogo } from '@/components/flower-logo'

type CreateCircleStepProps = {
  userId: string
  onCircleCreated: (circleId: string) => void
}

export function CreateCircleStep({ userId, onCircleCreated }: CreateCircleStepProps) {
  const [circleName, setCircleName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdCircle, setCreatedCircle] = useState<{
    name: string
    invite_link: string
    id: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setCreatedCircle(null)

    try {
      const response = await fetch('/api/create-circle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: circleName }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to create circle. Please try again.')
        setLoading(false)
        return
      }

      setCreatedCircle({
        name: result.circle.name,
        invite_link: result.circle.invite_link,
        id: result.circle.id,
      })
      setCircleName('')
      setLoading(false)
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!createdCircle?.invite_link) return

    try {
      await navigator.clipboard.writeText(createdCircle.invite_link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleContinue = () => {
    if (createdCircle) {
      onCircleCreated(createdCircle.id)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:py-8 bg-white pt-safe pb-safe">
      <div className="w-full max-w-lg sm:max-w-xl md:max-w-2xl space-y-5 sm:space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4 sm:mb-6">
            <FlowerLogo size={56} className="sm:w-16 sm:h-16" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-3 text-black px-2">
            Create Your Circle
          </h1>
          <p className="text-gray-600 text-sm sm:text-base md:text-lg px-2">
            Give your circle a name and invite friends to join
          </p>
        </div>

        {!createdCircle ? (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="circleName" className="block text-sm font-medium mb-2 text-black">
                Circle Name
              </label>
              <input
                id="circleName"
                type="text"
                value={circleName}
                onChange={(e) => setCircleName(e.target.value)}
                placeholder="Enter circle name"
                required
                className="w-full px-4 py-3.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose focus:border-transparent text-base touch-manipulation min-h-[44px]"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !circleName.trim()}
              className="w-full bg-rose text-white py-3.5 sm:py-3 px-6 rounded-lg hover:bg-rose-dark active:bg-rose-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base sm:text-lg transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
            >
              {loading ? 'Creating...' : 'Create Circle'}
            </button>
          </form>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 sm:p-5 space-y-3 sm:space-y-4">
              <p className="text-sm sm:text-base font-medium text-green-800">
                Circle "{createdCircle.name}" created successfully!
              </p>
              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700">
                  Shareable Invite Link:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={createdCircle.invite_link}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700"
                  />
                  <button
                    onClick={handleCopy}
                    className="p-2 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    title="Copy link"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>
                {copied && (
                  <p className="text-xs text-green-600">Link copied to clipboard!</p>
                )}
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mt-3">
                <p className="text-xs sm:text-sm text-yellow-800 font-medium">
                  Note: Only send this link to friends with Canadian phone numbers. US + International numbers will be available in January.
                </p>
              </div>
            </div>

            <button
              onClick={handleContinue}
              className="w-full bg-rose text-white py-3.5 sm:py-3 px-6 rounded-lg hover:bg-rose-dark active:bg-rose-dark font-medium text-base sm:text-lg transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
