'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CreateCircleForm() {
  const [circleName, setCircleName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdCircle, setCreatedCircle] = useState<{
    name: string
    invite_link: string
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

      setCreatedCircle(result.circle)
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

  return (
    <div className="w-full max-w-md space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="circleName" className="block text-sm font-medium text-gray-700 mb-2">
            Circle Name
          </label>
          <input
            id="circleName"
            type="text"
            value={circleName}
            onChange={(e) => setCircleName(e.target.value)}
            placeholder="Enter circle name"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose focus:border-transparent text-base"
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
          className="w-full bg-rose text-white py-3 px-6 rounded-lg hover:bg-rose-dark active:bg-rose-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base transition-colors"
        >
          {loading ? 'Creating...' : 'Create Circle'}
        </button>
      </form>

      {createdCircle && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-green-800">
            Circle "{createdCircle.name}" created successfully!
          </p>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
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
        </div>
      )}
    </div>
  )
}
