'use client'

import { useState } from 'react'
import { formatReflectionAsText, formatReflectionAsMarkdown, copyToClipboard, downloadAsFile, type ReflectionData } from '@/lib/utils/export-reflection'

type ExportReflectionProps = {
  reflection: ReflectionData
  weekStartDate?: Date
  weekEndDate?: Date
}

export function ExportReflection({ reflection, weekStartDate, weekEndDate }: ExportReflectionProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    // Debug: log reflection data to see what we're working with
    console.log('Export reflection data:', reflection)
    const text = formatReflectionAsText(reflection, weekStartDate, weekEndDate)
    console.log('Formatted text:', text)
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    setShowDropdown(false)
  }

  const handleDownloadText = () => {
    const text = formatReflectionAsText(reflection, weekStartDate, weekEndDate)
    const dateStr = weekStartDate 
      ? weekStartDate.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
    downloadAsFile(text, `rose-bud-thorn-${dateStr}.txt`, 'text/plain')
    setShowDropdown(false)
  }

  const handleDownloadMarkdown = () => {
    const markdown = formatReflectionAsMarkdown(reflection, weekStartDate, weekEndDate)
    const dateStr = weekStartDate 
      ? weekStartDate.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
    downloadAsFile(markdown, `rose-bud-thorn-${dateStr}.md`, 'text/markdown')
    setShowDropdown(false)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
      >
        Export Reflection
        <svg
          className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDropdown && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              <button
                onClick={handleCopy}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
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
                    Copy to Clipboard
                  </>
                )}
              </button>
              <button
                onClick={handleDownloadText}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download as Text
              </button>
              <button
                onClick={handleDownloadMarkdown}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download as Markdown
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

