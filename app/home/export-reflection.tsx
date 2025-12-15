'use client'

import { useState } from 'react'
import { formatReflectionAsText, copyToClipboard, hasPendingTranscripts, type ReflectionData } from '@/lib/utils/export-reflection'

type ExportReflectionProps = {
  reflection: ReflectionData
  weekStartDate?: Date
  weekEndDate?: Date
}

export function ExportReflection({ reflection, weekStartDate, weekEndDate }: ExportReflectionProps) {
  const [copied, setCopied] = useState(false)
  const hasPending = hasPendingTranscripts(reflection)

  const handleCopy = async () => {
    const text = formatReflectionAsText(reflection, weekStartDate, weekEndDate)
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="inline-flex items-center gap-3">
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium transition-colors"
      >
        {copied ? (
          <>
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-600">Copied!</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Copy Reflection to Clipboard</span>
          </>
        )}
      </button>
      {hasPending && (
        <span className="text-xs text-gray-500 flex items-center gap-1.5">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Transcribing...</span>
        </span>
      )}
    </div>
  )
}

