'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AudioRecorder } from '@/components/audio-recorder'
import { FlowerLogo } from '@/components/flower-logo'

type ReflectionDraft = {
  rose: string
  bud: string
  thorn: string
  rose_audio_url?: string | null
  bud_audio_url?: string | null
  thorn_audio_url?: string | null
}

type Step = 'rose' | 'bud' | 'thorn' | 'review'

const steps: Step[] = ['rose', 'bud', 'thorn', 'review']

type ReflectionFormProps = {
  weekId: string
  circleId: string
  userId: string
}

export function ReflectionForm({ weekId, circleId, userId }: ReflectionFormProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [currentStep, setCurrentStep] = useState<Step>('rose')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<ReflectionDraft>({
    rose: '',
    bud: '',
    thorn: '',
    rose_audio_url: null,
    bud_audio_url: null,
    thorn_audio_url: null,
  })

  // Load draft from localStorage
  useEffect(() => {
    const draftKey = `reflection_draft_${weekId}`
    const savedDraft = localStorage.getItem(draftKey)
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft) as ReflectionDraft
        setDraft(parsed)
      } catch (e) {
        console.error('Error parsing draft:', e)
      }
    }
  }, [weekId])

  // Save draft to localStorage whenever it changes
  useEffect(() => {
    if (weekId) {
      const draftKey = `reflection_draft_${weekId}`
      localStorage.setItem(draftKey, JSON.stringify(draft))
    }
  }, [draft, weekId])

  const updateDraft = (field: keyof ReflectionDraft, value: string) => {
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  const updateAudioUrl = (section: 'rose' | 'bud' | 'thorn', url: string | null) => {
    const field = `${section}_audio_url` as keyof ReflectionDraft
    setDraft(prev => ({ ...prev, [field]: url }))
  }

  const handleDiscardAudio = (section: 'rose' | 'bud' | 'thorn') => {
    updateAudioUrl(section, null)
  }

  const canProceed = (step: Step): boolean => {
    switch (step) {
      case 'rose':
        // Allow proceeding if either text or audio exists
        return draft.rose.trim().length > 0 || !!draft.rose_audio_url
      case 'bud':
        return draft.bud.trim().length > 0 || !!draft.bud_audio_url
      case 'thorn':
        return draft.thorn.trim().length > 0 || !!draft.thorn_audio_url
      default:
        return false
    }
  }

  const handleNext = () => {
    if (!canProceed(currentStep)) return

    const steps: Step[] = ['rose', 'bud', 'thorn', 'review']
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1])
    }
  }

  const handleBack = () => {
    const steps: Step[] = ['rose', 'bud', 'thorn', 'review']
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1])
    }
  }

  const handleSubmit = async () => {
    // Validate that each section has either text or audio
    const hasRose = draft.rose.trim().length > 0 || !!draft.rose_audio_url
    const hasBud = draft.bud.trim().length > 0 || !!draft.bud_audio_url
    const hasThorn = draft.thorn.trim().length > 0 || !!draft.thorn_audio_url
    
    if (!hasRose || !hasBud || !hasThorn) {
      setError('Please complete all three sections (text or audio) before submitting.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in to submit a reflection.')
        setLoading(false)
        return
      }

      // Submit reflection
      const { data: insertedReflection, error: submitError } = await supabase
        .from('reflections')
        .insert({
          circle_id: circleId,
          week_id: weekId,
          user_id: user.id,
          rose_text: draft.rose.trim(),
          bud_text: draft.bud.trim(),
          thorn_text: draft.thorn.trim(),
          rose_audio_url: draft.rose_audio_url || null,
          bud_audio_url: draft.bud_audio_url || null,
          thorn_audio_url: draft.thorn_audio_url || null,
          submitted_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (submitError || !insertedReflection) {
        console.error('Submission error:', submitError)
        setError(submitError?.message || 'Failed to submit reflection. Please try again.')
        setLoading(false)
        return
      }

      // Trigger transcription if any audio URLs exist (fire-and-forget)
      // The API will fetch audio URLs from the database
      const hasAudio = draft.rose_audio_url || draft.bud_audio_url || draft.thorn_audio_url
      if (hasAudio) {
        fetch('/api/transcribe-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reflectionId: insertedReflection.id,
          }),
        }).catch((err) => {
          // Log error but don't block the user flow
          console.error('Error triggering transcription:', err)
        })
      }

      // Check if circle is unlocked and send unlock SMS if needed
      // This is fire-and-forget - we don't wait for it to complete
      fetch('/api/send-unlock-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circleId, weekId }),
      }).catch((err) => {
        // Log error but don't block the user flow
        console.error('Error sending unlock SMS:', err)
      })

      // Clear draft from localStorage
      if (weekId) {
        const draftKey = `reflection_draft_${weekId}`
        localStorage.removeItem(draftKey)
      }

      // Redirect to home
      router.push('/home')
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const stepTitles = {
    rose: 'Rose',
    bud: 'Bud',
    thorn: 'Thorn',
    review: 'Review',
  }

  const stepDescriptions = {
    rose: 'What went well this week?',
    bud: 'Something emerging or full of potential?',
    thorn: 'Something challenging during the week?',
    review: 'Review your reflection before submitting',
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:p-12 md:p-24 pb-safe mb-safe bg-white">
      <div className="w-full max-w-3xl">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Review step - keep existing layout */}
        {currentStep === 'review' && (
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">Review</h2>
            <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8">Review your reflection before submitting</p>
            <div className="space-y-6 sm:space-y-8">
              <div>
                <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4 flex items-center gap-2">
                  <FlowerLogo size={24} className="sm:w-6 sm:h-6" />
                  Rose
                </h3>
                {draft.rose ? (
                  <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                    {draft.rose}
                  </p>
                ) : draft.rose_audio_url ? (
                  <p className="text-gray-600 italic bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                    Audio response
                  </p>
                ) : (
                  <p className="text-gray-500 italic bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                    (empty)
                  </p>
                )}
                {draft.rose_audio_url && (
                  <audio src={draft.rose_audio_url} controls className="w-full" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4 flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl">🌱</span>
                  Bud
                </h3>
                {draft.bud ? (
                  <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                    {draft.bud}
                  </p>
                ) : draft.bud_audio_url ? (
                  <p className="text-gray-600 italic bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                    Audio response
                  </p>
                ) : (
                  <p className="text-gray-500 italic bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                    (empty)
                  </p>
                )}
                {draft.bud_audio_url && (
                  <audio src={draft.bud_audio_url} controls className="w-full" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4 flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl">🌵</span>
                  Thorn
                </h3>
                {draft.thorn ? (
                  <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                    {draft.thorn}
                  </p>
                ) : draft.thorn_audio_url ? (
                  <p className="text-gray-600 italic bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                    Audio response
                  </p>
                ) : (
                  <p className="text-gray-500 italic bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                    (empty)
                  </p>
                )}
                {draft.thorn_audio_url && (
                  <audio src={draft.thorn_audio_url} controls className="w-full" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Rose, Bud, Thorn steps - new clean layout */}
        {(currentStep === 'rose' || currentStep === 'bud' || currentStep === 'thorn') && (
          <div className="text-center space-y-6 sm:space-y-8">
            {/* Step icon - different for each step (no border) */}
            <div className="flex justify-center">
              {currentStep === 'rose' ? (
                <FlowerLogo size={64} className="sm:w-20 sm:h-20" />
              ) : currentStep === 'bud' ? (
                <span className="text-5xl sm:text-6xl md:text-7xl">🌱</span>
              ) : (
                <span className="text-5xl sm:text-6xl md:text-7xl">🌵</span>
              )}
            </div>

            {/* Step title in pink */}
            <h2 className="text-2xl sm:text-3xl font-bold text-rose">{stepTitles[currentStep]}</h2>

            {/* Question prompt */}
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-black">
              {stepDescriptions[currentStep]}
            </p>

            {/* Text area */}
            <div className="text-left">
              <textarea
                value={draft[currentStep]}
                onChange={(e) => updateDraft(currentStep, e.target.value)}
                placeholder="Share your thoughts..."
                className="w-full min-h-[200px] sm:min-h-[240px] p-4 sm:p-5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose focus:border-transparent resize-none"
              />
            </div>

            {/* Navigation buttons */}
            <div className={`flex flex-row gap-3 sm:gap-4 ${currentStep === 'rose' ? 'justify-center' : ''}`}>
              {/* Back button - show for bud and thorn */}
              {currentStep !== 'rose' ? (
                <button
                  onClick={handleBack}
                  disabled={loading}
                  className="flex-1 px-6 sm:px-8 py-3 sm:py-3 text-base sm:text-lg border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors touch-manipulation min-h-[44px] flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              ) : null}
              
              {/* Next button */}
              <button
                onClick={handleNext}
                disabled={!canProceed(currentStep) || loading}
                className={`${currentStep === 'rose' ? 'px-8 sm:px-10' : 'flex-1'} bg-rose text-white py-3 sm:py-3.5 rounded-lg hover:bg-rose-dark active:bg-rose-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base sm:text-lg transition-colors touch-manipulation min-h-[44px] flex items-center justify-center gap-2`}
              >
                Next
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Audio recorder - positioned below Next button */}
            {userId && weekId && (
              <div className="flex justify-center">
                <AudioRecorder
                  onAudioUploaded={(url) => updateAudioUrl(currentStep, url)}
                  onDiscard={() => handleDiscardAudio(currentStep)}
                  existingAudioUrl={draft[`${currentStep}_audio_url` as keyof ReflectionDraft] as string | null}
                  userId={userId}
                  weekId={weekId}
                  section={currentStep}
                />
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons - only show for review step */}
        {currentStep === 'review' && (
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-between pb-4 sm:pb-0">
            <button
              onClick={handleBack}
              disabled={loading}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3 text-base sm:text-lg border-2 border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Back
            </button>

            <button
              onClick={handleSubmit}
              disabled={
                loading || 
                (!draft.rose.trim() && !draft.rose_audio_url) ||
                (!draft.bud.trim() && !draft.bud_audio_url) ||
                (!draft.thorn.trim() && !draft.thorn_audio_url)
              }
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3 text-base sm:text-lg bg-rose text-white rounded-md hover:bg-rose-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Submitting...' : 'Submit Reflection'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
