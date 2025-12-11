'use client'

// Trigger fresh deployment with latest fixes
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentWeekClient } from '@/lib/supabase/week'
import { AudioRecorder } from '@/components/audio-recorder'

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

export default function ReflectionPage() {
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
  const [weekId, setWeekId] = useState<string | null>(null)
  const [circleId, setCircleId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Load draft from localStorage and get week/circle info
  useEffect(() => {
    const loadData = async () => {
      // Get current week
      const week = await getCurrentWeekClient(supabase)

      if (!week) {
        console.error('Unable to load current week')
        return
      }

      setWeekId(week.id)
        
      // Get user's circle
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: membership } = await supabase
          .from('circle_members')
          .select('circle_id')
          .eq('user_id', user.id)
          .single()
        
        if (membership) {
          setCircleId(membership.circle_id)
          
          // Load draft from localStorage
          const draftKey = `reflection_draft_${week.id}`
          const savedDraft = localStorage.getItem(draftKey)
          if (savedDraft) {
            try {
              const parsed = JSON.parse(savedDraft) as ReflectionDraft
              setDraft(parsed)
            } catch (e) {
              console.error('Error parsing draft:', e)
            }
          }
        }
      }
    }

    loadData()
  }, [supabase])

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
    if (!weekId || !circleId) {
      setError('Missing week or circle information. Please refresh and try again.')
      return
    }

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

      // Redirect to dashboard
      router.push('/dashboard')
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
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {(['rose', 'bud', 'thorn', 'review'] as Step[]).map((step, index) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    currentStep === step
                      ? 'bg-blue-600 text-white'
                      : steps.indexOf(currentStep) > index
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {index + 1}
                </div>
                {index < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      steps.indexOf(currentStep) > index ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold mb-2">{stepTitles[currentStep]}</h2>
          <p className="text-gray-600 mb-6">{stepDescriptions[currentStep]}</p>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {currentStep === 'rose' && (
            <div>
              <textarea
                value={draft.rose}
                onChange={(e) => updateDraft('rose', e.target.value)}
                placeholder="Share what went well this week..."
                className="w-full h-48 p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              {userId && weekId && (
                <AudioRecorder
                  onAudioUploaded={(url) => updateAudioUrl('rose', url)}
                  onDiscard={() => handleDiscardAudio('rose')}
                  existingAudioUrl={draft.rose_audio_url}
                  userId={userId}
                  weekId={weekId}
                  section="rose"
                />
              )}
            </div>
          )}

          {currentStep === 'bud' && (
            <div>
              <textarea
                value={draft.bud}
                onChange={(e) => updateDraft('bud', e.target.value)}
                placeholder="What's emerging or full of potential?"
                className="w-full h-48 p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              {userId && weekId && (
                <AudioRecorder
                  onAudioUploaded={(url) => updateAudioUrl('bud', url)}
                  onDiscard={() => handleDiscardAudio('bud')}
                  existingAudioUrl={draft.bud_audio_url}
                  userId={userId}
                  weekId={weekId}
                  section="bud"
                />
              )}
            </div>
          )}

          {currentStep === 'thorn' && (
            <div>
              <textarea
                value={draft.thorn}
                onChange={(e) => updateDraft('thorn', e.target.value)}
                placeholder="What was challenging this week?"
                className="w-full h-48 p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              {userId && weekId && (
                <AudioRecorder
                  onAudioUploaded={(url) => updateAudioUrl('thorn', url)}
                  onDiscard={() => handleDiscardAudio('thorn')}
                  existingAudioUrl={draft.thorn_audio_url}
                  userId={userId}
                  weekId={weekId}
                  section="thorn"
                />
              )}
            </div>
          )}

          {currentStep === 'review' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">Rose</h3>
                <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded mb-2">
                  {draft.rose || '(empty)'}
                </p>
                {draft.rose_audio_url && (
                  <audio src={draft.rose_audio_url} controls className="w-full" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Bud</h3>
                <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded mb-2">
                  {draft.bud || '(empty)'}
                </p>
                {draft.bud_audio_url && (
                  <audio src={draft.bud_audio_url} controls className="w-full" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Thorn</h3>
                <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded mb-2">
                  {draft.thorn || '(empty)'}
                </p>
                {draft.thorn_audio_url && (
                  <audio src={draft.thorn_audio_url} controls className="w-full" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 'rose' || loading}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>

          {currentStep === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={
                loading || 
                (!draft.rose.trim() && !draft.rose_audio_url) ||
                (!draft.bud.trim() && !draft.bud_audio_url) ||
                (!draft.thorn.trim() && !draft.thorn_audio_url)
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Reflection'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!canProceed(currentStep) || loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </main>
  )
}


