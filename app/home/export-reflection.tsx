'use client'

import { useState } from 'react'
import { formatReflectionAsText, copyToClipboard, type ReflectionData } from '@/lib/utils/export-reflection'

type ExportReflectionProps = {
  reflection: ReflectionData
  weekStartDate?: Date
  weekEndDate?: Date
}

export function ExportReflection({ reflection, weekStartDate, weekEndDate }: ExportReflectionProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = formatReflectionAsText(reflection, weekStartDate, weekEndDate)
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
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
  )
}

