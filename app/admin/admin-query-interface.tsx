'use client'

import { useState } from 'react'

type QueryResult = {
  success: boolean
  sql?: string
  rows?: any[]
  rowCount?: number
  columns?: string[]
  error?: string
  details?: string
}

export function AdminQueryInterface() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSQL, setShowSQL] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!query.trim()) {
      setError('Please enter a query')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/admin/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Query failed')
        setResult({
          success: false,
          error: data.error,
          details: data.details,
          sql: data.sql,
        })
      } else {
        setResult(data)
        setShowSQL(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setResult({
        success: false,
        error: 'Network error',
        details: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-black">Admin Query Interface</h1>
        <p className="text-gray-600">
          Ask questions about your app's data in natural language. The system will translate your query to SQL and execute it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
            Your Question
          </label>
          <textarea
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., How many users have completed reflections this week?"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose focus:border-transparent resize-y min-h-[120px] text-base"
            disabled={loading}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-rose text-white px-6 py-3 rounded-lg hover:bg-rose-dark active:bg-rose-dark font-medium text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {loading ? 'Processing...' : 'Execute Query'}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          {result?.details && (
            <p className="text-red-600 text-sm mt-2">{result.details}</p>
          )}
        </div>
      )}

      {result && result.sql && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Generated SQL</p>
            <button
              onClick={() => setShowSQL(!showSQL)}
              className="text-sm text-rose hover:text-rose-dark"
            >
              {showSQL ? 'Hide' : 'Show'}
            </button>
          </div>
          {showSQL && (
            <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto mt-2">
              <code>{result.sql}</code>
            </pre>
          )}
        </div>
      )}

      {result && result.success && result.rows && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-black">Results</h2>
            <p className="text-sm text-gray-600">
              {result.rowCount || 0} row{result.rowCount !== 1 ? 's' : ''}
            </p>
          </div>

          {result.rows.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-600">No results found</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      {result.columns?.map((column) => (
                        <th
                          key={column}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {result.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50">
                        {result.columns?.map((column) => (
                          <td
                            key={column}
                            className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap"
                          >
                            {row[column] !== null && row[column] !== undefined
                              ? String(row[column])
                              : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {result && !result.success && result.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Query Failed</p>
          <p className="text-red-600 text-sm mt-1">{result.error}</p>
          {result.details && (
            <p className="text-red-600 text-sm mt-2">{result.details}</p>
          )}
        </div>
      )}
    </div>
  )
}

