'use client'

import { useState } from 'react'
import { FlowerLogo } from '@/components/flower-logo'
import { CircleSwitcher } from '@/app/home/circle-switcher'
import { HamburgerMenu } from '@/app/home/hamburger-menu'
import { MemberStatus } from '@/app/home/member-status'
import { ReadingStatus } from '@/app/home/reading-status'
import { PhotoUploader } from '@/components/photo-uploader'
import { ReviewDisplay } from '@/app/review/[weekId]/review-display'

// Development-only preview page for visual testing
// Returns 404 in production (handled by notFound() in server component wrapper)

// Mock data
const mockCircles = [
  { id: 'circle-1', name: 'Family Circle' },
  { id: 'circle-2', name: 'Work Circle' },
]

const mockMembers = [
  { userId: 'user-1', firstName: 'Alice', hasCompleted: true },
  { userId: 'user-2', firstName: 'Bob', hasCompleted: true },
  { userId: 'user-3', firstName: 'Charlie', hasCompleted: false },
  { userId: 'user-4', firstName: 'Diana', hasCompleted: false },
]

const mockReflection = {
  reflection_id: 'reflection-1',
  user_id: 'user-1',
  first_name: 'Alice',
  rose_text: 'This week I had a great time at the park with my family. The weather was perfect and we enjoyed a lovely picnic together.',
  bud_text: 'I\'m excited about starting my new painting project. I\'ve been gathering inspiration and can\'t wait to begin.',
  thorn_text: 'I struggled with time management this week. There were too many meetings and I felt overwhelmed.',
  rose_audio_url: null,
  bud_audio_url: null,
  thorn_audio_url: null,
  rose_transcript: null,
  bud_transcript: null,
  thorn_transcript: null,
  photo_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
  photo_caption: 'Beautiful sunset from our weekend hike',
  submitted_at: new Date().toISOString(),
}

const mockReflectionWithAudio = {
  ...mockReflection,
  rose_audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  rose_transcript: 'This is a transcribed version of the audio response. The user recorded their thoughts about what went well this week.',
}

type PreviewSection = 'home' | 'reflection-form' | 'reflection-photo' | 'review' | 'read'

export default function PreviewPage() {
  const [selectedSection, setSelectedSection] = useState<PreviewSection>('home')
  const [currentStep, setCurrentStep] = useState<'rose' | 'bud' | 'thorn' | 'photo' | 'review'>('rose')
  const [mockPhotoUrl, setMockPhotoUrl] = useState<string | null>(null)
  const [mockPhotoCaption, setMockPhotoCaption] = useState<string>('')

  const sections: { id: PreviewSection; label: string }[] = [
    { id: 'home', label: 'Home Page' },
    { id: 'reflection-form', label: 'Reflection Form' },
    { id: 'reflection-photo', label: 'Photo Step' },
    { id: 'review', label: 'Review Page' },
    { id: 'read', label: 'Read Page' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Preview Banner */}
      <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-2 text-center">
        <p className="text-sm font-medium text-yellow-800">
          🎨 PREVIEW MODE - Visual Testing Only (Development)
        </p>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  setSelectedSection(section.id)
                  if (section.id === 'reflection-form') {
                    setCurrentStep('rose')
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedSection === section.id
                    ? 'bg-rose text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {selectedSection === 'home' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Home Page Preview</h2>
            
            {/* Home Page Layout */}
            <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:p-12 md:p-24 pb-safe mb-safe bg-white">
              <div className="w-full max-w-3xl">
                {/* Circle Switcher */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 mb-6">
                  <CircleSwitcher circles={mockCircles} currentCircleId={mockCircles[0].id} />
                </div>

                {/* Hamburger Menu */}
                <HamburgerMenu currentCircleId={mockCircles[0].id} />

                {/* Logo */}
                <div className="flex justify-center mb-8 sm:mb-12">
                  <FlowerLogo size={80} className="sm:w-24 sm:h-24" />
                </div>

                {/* Member Status */}
                <div className="mb-8">
                  <MemberStatus members={mockMembers} />
                </div>

                {/* Reading Status */}
                <div className="mb-8">
                  <ReadingStatus weekId="week-1" isUnlocked={true} />
                </div>
              </div>
            </main>
          </div>
        )}

        {selectedSection === 'reflection-form' && (
          <div className="space-y-8">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Reflection Form Preview</h2>
              <div className="flex gap-2">
                {(['rose', 'bud', 'thorn', 'photo', 'review'] as const).map((step) => (
                  <button
                    key={step}
                    onClick={() => setCurrentStep(step)}
                    className={`px-3 py-1 rounded text-sm ${
                      currentStep === step
                        ? 'bg-rose text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {step.charAt(0).toUpperCase() + step.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Reflection Form Steps */}
            <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:p-12 md:p-24 pb-safe mb-safe bg-white">
              <div className="w-full max-w-3xl">
                {currentStep === 'rose' && (
                  <div className="text-center space-y-6 sm:space-y-8">
                    <FlowerLogo size={64} className="sm:w-20 sm:h-20 mx-auto" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-rose">Rose</h2>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-black">
                      What went well this week?
                    </p>
                    <textarea
                      placeholder="Share your thoughts..."
                      className="w-full min-h-[200px] sm:min-h-[240px] p-4 sm:p-5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose focus:border-transparent resize-none"
                      defaultValue="This week I had a great time at the park with my family..."
                    />
                  </div>
                )}

                {currentStep === 'bud' && (
                  <div className="text-center space-y-6 sm:space-y-8">
                    <span className="text-5xl sm:text-6xl md:text-7xl block">🌱</span>
                    <h2 className="text-2xl sm:text-3xl font-bold text-rose">Bud</h2>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-black">
                      Something emerging or full of potential?
                    </p>
                    <textarea
                      placeholder="Share your thoughts..."
                      className="w-full min-h-[200px] sm:min-h-[240px] p-4 sm:p-5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose focus:border-transparent resize-none"
                      defaultValue="I'm excited about starting my new painting project..."
                    />
                  </div>
                )}

                {currentStep === 'thorn' && (
                  <div className="text-center space-y-6 sm:space-y-8">
                    <span className="text-5xl sm:text-6xl md:text-7xl block">🌵</span>
                    <h2 className="text-2xl sm:text-3xl font-bold text-rose">Thorn</h2>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-black">
                      Something challenging during the week?
                    </p>
                    <textarea
                      placeholder="Share your thoughts..."
                      className="w-full min-h-[200px] sm:min-h-[240px] p-4 sm:p-5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose focus:border-transparent resize-none"
                      defaultValue="I struggled with time management this week..."
                    />
                  </div>
                )}

                {currentStep === 'photo' && (
                  <div className="text-center space-y-6 sm:space-y-8">
                    <span className="text-5xl sm:text-6xl md:text-7xl block">📷</span>
                    <h2 className="text-2xl sm:text-3xl font-bold text-rose">Photo of the week</h2>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-black">
                      Share a photo from your week (optional)
                    </p>
                    <div className="flex justify-center">
                      <PhotoUploader
                        onPhotoUploaded={(url, caption) => {
                          setMockPhotoUrl(url)
                          setMockPhotoCaption(caption)
                        }}
                        onDiscard={() => {
                          setMockPhotoUrl(null)
                          setMockPhotoCaption('')
                        }}
                        existingPhotoUrl={mockPhotoUrl}
                        existingCaption={mockPhotoCaption}
                        userId="mock-user-id"
                        weekId="mock-week-id"
                      />
                    </div>
                  </div>
                )}

                {currentStep === 'review' && (
                  <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">Review</h2>
                    <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8">
                      Review your reflection before submitting
                    </p>
                    <div className="space-y-6 sm:space-y-8">
                      {/* Rose */}
                      <div>
                        <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4 flex items-center gap-2">
                          <FlowerLogo size={24} className="sm:w-6 sm:h-6" />
                          Rose
                        </h3>
                        <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                          This week I had a great time at the park with my family...
                        </p>
                      </div>
                      {/* Bud */}
                      <div>
                        <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4 flex items-center gap-2">
                          <span className="text-2xl sm:text-3xl">🌱</span>
                          Bud
                        </h3>
                        <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                          I'm excited about starting my new painting project...
                        </p>
                      </div>
                      {/* Thorn */}
                      <div>
                        <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4 flex items-center gap-2">
                          <span className="text-2xl sm:text-3xl">🌵</span>
                          Thorn
                        </h3>
                        <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                          I struggled with time management this week...
                        </p>
                      </div>
                      {/* Photo */}
                      {mockPhotoUrl && (
                        <div>
                          <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4 flex items-center gap-2">
                            <span className="text-2xl sm:text-3xl">📷</span>
                            Photo of the week
                          </h3>
                          <img
                            src={mockPhotoUrl}
                            alt={mockPhotoCaption || "Photo of the week"}
                            className="w-full max-w-md mx-auto rounded-lg border border-gray-200"
                          />
                          {mockPhotoCaption && (
                            <p className="text-gray-600 text-sm italic text-center mt-2">
                              {mockPhotoCaption}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
        )}

        {selectedSection === 'reflection-photo' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Photo Upload Step Preview</h2>
            <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:p-12 md:p-24 pb-safe mb-safe bg-white">
              <div className="w-full max-w-3xl">
                <div className="text-center space-y-6 sm:space-y-8">
                  <span className="text-5xl sm:text-6xl md:text-7xl block">📷</span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-rose">Photo of the week</h2>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-black">
                    Share a photo from your week (optional)
                  </p>
                  <div className="flex justify-center">
                    <PhotoUploader
                      onPhotoUploaded={(url, caption) => {
                        setMockPhotoUrl(url)
                        setMockPhotoCaption(caption)
                      }}
                      onDiscard={() => {
                        setMockPhotoUrl(null)
                        setMockPhotoCaption('')
                      }}
                      existingPhotoUrl={mockPhotoUrl}
                      existingCaption={mockPhotoCaption}
                      userId="mock-user-id"
                      weekId="mock-week-id"
                    />
                  </div>
                </div>
              </div>
            </main>
          </div>
        )}

        {selectedSection === 'review' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Review Page Preview</h2>
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8">
              <ReviewDisplay
                weekId="week-1"
                weekStart={new Date().toISOString()}
                weekEnd={new Date().toISOString()}
                reflections={[mockReflection, mockReflectionWithAudio]}
                commentsByReflection={new Map()}
                currentUserId="user-1"
                wasUnlocked={true}
              />
            </div>
          </div>
        )}

        {selectedSection === 'read' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Read Page Preview</h2>
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8">
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4 flex items-center gap-2">
                    <FlowerLogo size={24} className="sm:w-6 sm:h-6" />
                    Rose
                  </h3>
                  <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                    {mockReflection.rose_text}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4 flex items-center gap-2">
                    <span className="text-2xl sm:text-3xl">🌱</span>
                    Bud
                  </h3>
                  <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                    {mockReflection.bud_text}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4 flex items-center gap-2">
                    <span className="text-2xl sm:text-3xl">🌵</span>
                    Thorn
                  </h3>
                  <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 sm:p-5 rounded mb-3 sm:mb-4 text-base sm:text-lg">
                    {mockReflection.thorn_text}
                  </p>
                </div>
                {mockReflection.photo_url && (
                  <div className="mt-6 space-y-2">
                    <h3 className="font-semibold text-lg sm:text-xl mb-3 sm:mb-4">📷 Photo of the week</h3>
                    <img
                      src={mockReflection.photo_url}
                      alt={mockReflection.photo_caption || "Photo of the week"}
                      className="w-full max-w-md mx-auto rounded-lg border border-gray-200"
                    />
                    {mockReflection.photo_caption && (
                      <p className="text-gray-600 text-sm italic text-center mt-2">
                        {mockReflection.photo_caption}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
