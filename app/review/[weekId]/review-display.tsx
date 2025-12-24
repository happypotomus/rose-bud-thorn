'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CommentSection } from '@/app/read/comment-section'
import { formatReflectionAsText, copyToClipboard, hasPendingTranscripts } from '@/lib/utils/export-reflection'
import Link from 'next/link'

type ReflectionWithAuthor = {
  reflection_id: string
  user_id: string
  first_name: string
  rose_text: string | null
  bud_text: string | null
  thorn_text: string | null
  rose_audio_url: string | null
  bud_audio_url: string | null
  thorn_audio_url: string | null
  rose_transcript: string | null
  bud_transcript: string | null
  thorn_transcript: string | null
  photo_url: string | null
  photo_caption: string | null
  submitted_at: string | null
}

type CommentWithAuthor = {
  id: string
  reflection_id: string
  user_id: string
  comment_text: string
  created_at: string
  commenter_name: string
}

type ReviewDisplayProps = {
  weekId: string
  weekStart: string
  weekEnd: string
  reflections: ReflectionWithAuthor[]
  commentsByReflection: Map<string, CommentWithAuthor[]>
  currentUserId: string
  wasUnlocked: boolean
}

export function ReviewDisplay({
  weekId,
  weekStart,
  weekEnd,
  reflections,
  commentsByReflection,
  currentUserId,
  wasUnlocked,
}: ReviewDisplayProps) {
  const [commentsMap, setCommentsMap] = useState<Map<string, CommentWithAuthor[]>>(commentsByReflection)
  const [showTranscripts, setShowTranscripts] = useState<Record<string, { rose: boolean; bud: boolean; thorn: boolean }>>({})
  const [copiedReflectionId, setCopiedReflectionId] = useState<string | null>(null)
  const supabase = createClient()

  const formatWeekRange = (start: string, end: string): string => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' })
    const startDay = startDate.getDate()
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' })
    const endDay = endDate.getDate()
    
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}`
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}`
    }
  }

  const toggleTranscript = (reflectionId: string, section: 'rose' | 'bud' | 'thorn') => {
    setShowTranscripts(prev => ({
      ...prev,
      [reflectionId]: {
        ...prev[reflectionId],
        [section]: !prev[reflectionId]?.[section],
      },
    }))
  }

  const handleCommentAdded = async () => {
    // Re-fetch comments after adding a new one
    const reflectionIds = reflections.map(r => r.reflection_id)
    const { data: commentsData } = await supabase
      .from('comments')
      .select(`
        id,
        reflection_id,
        user_id,
        comment_text,
        created_at
      `)
      .in('reflection_id', reflectionIds)
      .order('created_at', { ascending: true })

    if (commentsData) {
      // Get commenter profiles
      const commenterIds = [...new Set(commentsData.map(c => c.user_id))]
      const { data: commenterProfiles } = await supabase
        .from('profiles')
        .select('id, first_name')
        .in('id', commenterIds)

      const commenterMap = new Map<string, string>()
      if (commenterProfiles) {
        commenterProfiles.forEach(p => {
          commenterMap.set(p.id, p.first_name || 'Friend')
        })
      }

      // Group comments by reflection_id
      const newCommentsMap = new Map<string, CommentWithAuthor[]>()
      commentsData.forEach(c => {
        const comment: CommentWithAuthor = {
          id: c.id,
          reflection_id: c.reflection_id,
          user_id: c.user_id,
          comment_text: c.comment_text,
          created_at: c.created_at,
          commenter_name: commenterMap.get(c.user_id) || 'Friend',
        }
        const existing = newCommentsMap.get(c.reflection_id) || []
        newCommentsMap.set(c.reflection_id, [...existing, comment])
      })

      setCommentsMap(newCommentsMap)
    }
  }

  const getReflectionData = (reflection: ReflectionWithAuthor) => {
    return {
      rose_text: reflection.rose_text,
      bud_text: reflection.bud_text,
      thorn_text: reflection.thorn_text,
      rose_transcript: reflection.rose_transcript,
      bud_transcript: reflection.bud_transcript,
      thorn_transcript: reflection.thorn_transcript,
      rose_audio_url: reflection.rose_audio_url,
      bud_audio_url: reflection.bud_audio_url,
      thorn_audio_url: reflection.thorn_audio_url,
      submitted_at: reflection.submitted_at,
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-6 sm:py-8 md:p-24 pt-safe pb-safe">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Link
            href="/review"
            className="text-gray-600 hover:text-gray-800 text-sm sm:text-base inline-flex items-center gap-2 mb-4"
          >
            ← Back to Review
          </Link>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
            Week of {formatWeekRange(weekStart, weekEnd)}
          </h1>
        </div>

        {/* Reflections List */}
        <div className="space-y-6 sm:space-y-8">
          {reflections.map((reflection) => {
            const isOwnReflection = reflection.user_id === currentUserId
            const reflectionComments = commentsMap.get(reflection.reflection_id) || []
            const transcriptState = showTranscripts[reflection.reflection_id] || { rose: false, bud: false, thorn: false }

            return (
              <div
                key={reflection.reflection_id}
                className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8"
              >
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">
                    {reflection.first_name}'s Reflection
                    {isOwnReflection && (
                      <span className="ml-2 text-sm sm:text-base font-normal text-gray-500">(You)</span>
                    )}
                  </h2>
                  {isOwnReflection && (
                    <button
                      onClick={async () => {
                        const reflectionData = getReflectionData(reflection)
                        const text = formatReflectionAsText(reflectionData, new Date(weekStart), new Date(weekEnd))
                        const success = await copyToClipboard(text)
                        if (success) {
                          setCopiedReflectionId(reflection.reflection_id)
                          setTimeout(() => setCopiedReflectionId(null), 2000)
                        }
                      }}
                      className="flex-shrink-0 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                      title="Copy reflection to clipboard"
                    >
                      {copiedReflectionId === reflection.reflection_id ? (
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>

                <div className="space-y-6 sm:space-y-8">
                  {/* Rose Section */}
                  <div>
                    <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4 text-rose-600">🌹 Rose</h3>
                    {reflection.rose_text ? (
                      <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                        {reflection.rose_text}
                      </p>
                    ) : reflection.rose_audio_url ? (
                      <>
                        <p className="text-gray-600 italic bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                          Audio response
                        </p>
                        <div className="mt-4 sm:mt-3 space-y-3 sm:space-y-2">
                          <audio src={reflection.rose_audio_url} controls className="w-full" />
                          <button
                            onClick={() => toggleTranscript(reflection.reflection_id, 'rose')}
                            className="text-base sm:text-sm text-blue-600 hover:text-blue-800 underline font-medium py-2"
                          >
                            {transcriptState.rose ? 'Hide Transcribed Version' : 'View Transcribed Version'}
                          </button>
                          {transcriptState.rose && (
                            <div className="mt-2 p-4 sm:p-3 bg-blue-50 rounded border-2 border-blue-200">
                              {reflection.rose_transcript ? (
                                <p className="text-gray-700 whitespace-pre-wrap text-sm sm:text-base">
                                  {reflection.rose_transcript}
                                </p>
                              ) : (
                                <p className="text-gray-600 italic text-sm sm:text-base">
                                  We couldn't generate a transcript for this recording. Please listen to the audio instead.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-500 italic bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                        (No response)
                      </p>
                    )}
                  </div>

                  {/* Bud Section */}
                  <div>
                    <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4 text-green-600">🌱 Bud</h3>
                    {reflection.bud_text ? (
                      <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                        {reflection.bud_text}
                      </p>
                    ) : reflection.bud_audio_url ? (
                      <>
                        <p className="text-gray-600 italic bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                          Audio response
                        </p>
                        <div className="mt-4 sm:mt-3 space-y-3 sm:space-y-2">
                          <audio src={reflection.bud_audio_url} controls className="w-full" />
                          <button
                            onClick={() => toggleTranscript(reflection.reflection_id, 'bud')}
                            className="text-base sm:text-sm text-blue-600 hover:text-blue-800 underline font-medium py-2"
                          >
                            {transcriptState.bud ? 'Hide Transcribed Version' : 'View Transcribed Version'}
                          </button>
                          {transcriptState.bud && (
                            <div className="mt-2 p-4 sm:p-3 bg-blue-50 rounded border-2 border-blue-200">
                              {reflection.bud_transcript ? (
                                <p className="text-gray-700 whitespace-pre-wrap text-sm sm:text-base">
                                  {reflection.bud_transcript}
                                </p>
                              ) : (
                                <p className="text-gray-600 italic text-sm sm:text-base">
                                  We couldn't generate a transcript for this recording. Please listen to the audio instead.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-500 italic bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                        (No response)
                      </p>
                    )}
                  </div>

                  {/* Thorn Section */}
                  <div>
                    <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4 text-orange-600">🌵 Thorn</h3>
                    {reflection.thorn_text ? (
                      <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                        {reflection.thorn_text}
                      </p>
                    ) : reflection.thorn_audio_url ? (
                      <>
                        <p className="text-gray-600 italic bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                          Audio response
                        </p>
                        <div className="mt-4 sm:mt-3 space-y-3 sm:space-y-2">
                          <audio src={reflection.thorn_audio_url} controls className="w-full" />
                          <button
                            onClick={() => toggleTranscript(reflection.reflection_id, 'thorn')}
                            className="text-base sm:text-sm text-blue-600 hover:text-blue-800 underline font-medium py-2"
                          >
                            {transcriptState.thorn ? 'Hide Transcribed Version' : 'View Transcribed Version'}
                          </button>
                          {transcriptState.thorn && (
                            <div className="mt-2 p-4 sm:p-3 bg-blue-50 rounded border-2 border-blue-200">
                              {reflection.thorn_transcript ? (
                                <p className="text-gray-700 whitespace-pre-wrap text-sm sm:text-base">
                                  {reflection.thorn_transcript}
                                </p>
                              ) : (
                                <p className="text-gray-600 italic text-sm sm:text-base">
                                  We couldn't generate a transcript for this recording. Please listen to the audio instead.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-500 italic bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                        (No response)
                      </p>
                    )}
                  </div>
                </div>

                {/* Photo Section */}
                {reflection.photo_url && (
                  <div className="mt-6 space-y-2">
                    <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4">📷 Photo of the week</h3>
                    <img
                      src={reflection.photo_url}
                      alt={reflection.photo_caption || "Photo of the week"}
                      className="w-full max-w-md mx-auto rounded-lg border border-gray-200"
                    />
                    {reflection.photo_caption && (
                      <p className="text-gray-600 text-sm italic text-center mt-2">
                        {reflection.photo_caption}
                      </p>
                    )}
                  </div>
                )}

                {/* Comments Section */}
                <CommentSection
                  reflectionId={reflection.reflection_id}
                  comments={reflectionComments}
                  isUnlocked={wasUnlocked}
                  currentUserId={currentUserId}
                  onCommentAdded={handleCommentAdded}
                />
              </div>
            )
          })}
        </div>

        {/* Back to Review Button */}
        <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-gray-200">
          <Link
            href="/review"
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-base sm:text-lg transition-colors"
          >
            ← Back to Review
          </Link>
        </div>
      </div>
    </main>
  )
}
