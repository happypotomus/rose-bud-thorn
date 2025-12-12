import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek } from '@/lib/supabase/week-server'
import { isCircleUnlocked } from '@/lib/supabase/unlock'
import { ReadingStatus } from './reading-status'
import { ExportReflection } from './export-reflection'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/invite')
  }

  // Get user's profile and circle info
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('id', user.id)
    .single()

  const { data: membership } = await supabase
    .from('circle_members')
    .select(`
      circle_id,
      circles (
        name
      )
    `)
    .eq('user_id', user.id)
    .single()

  // Get or create current week
  const currentWeek = await getCurrentWeek()
  
  if (!currentWeek) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:py-8 md:p-24 pt-safe pb-safe">
        <div className="text-center w-full max-w-2xl">
          <div className="bg-yellow-100 p-4 sm:p-5 rounded-lg mb-4">
            <p className="text-sm sm:text-base text-yellow-700">
              Unable to load current week. Please refresh the page.
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (!membership) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:py-8 md:p-24 pt-safe pb-safe">
        <div className="text-center w-full max-w-2xl">
          <p className="text-base sm:text-lg md:text-xl text-gray-600">
            You're not in a circle yet.
          </p>
        </div>
      </main>
    )
  }

  const circleId = membership.circle_id
  const circleName = Array.isArray(membership.circles)
    ? membership.circles[0]?.name ?? 'Your Circle'
    : ((membership.circles as { name?: string } | null)?.name ?? 'Your Circle')

  // Check if user has a reflection for current week
  const { data: reflection } = await supabase
    .from('reflections')
    .select(`
      id, 
      submitted_at,
      rose_text,
      bud_text,
      thorn_text,
      rose_transcript,
      bud_transcript,
      thorn_transcript
    `)
    .eq('user_id', user.id)
    .eq('circle_id', circleId)
    .eq('week_id', currentWeek.id)
    .single()

  // Check if circle is unlocked using real unlock logic
  const isUnlocked = await isCircleUnlocked(circleId, currentWeek.id)

  // Check if user has read all reflections (client-side check via localStorage)
  // We'll check this on the client side since localStorage is client-only
  const hasReadReflections = false // Will be checked client-side

  // Determine dashboard state
  let dashboardState: 'no_reflection' | 'waiting' | 'unlocked' | 'read' = 'no_reflection'
  
  if (!reflection) {
    dashboardState = 'no_reflection'
  } else if (reflection && !isUnlocked) {
    dashboardState = 'waiting'
  } else if (isUnlocked) {
    // Check reading status will be done client-side
    dashboardState = 'unlocked'
  }

  // Explicitly map reflection data to ensure proper serialization when passing to client component
  // Convert empty strings to null for consistent handling (empty strings come from audio-only submissions)
  const reflectionData = reflection ? {
    rose_text: reflection.rose_text && reflection.rose_text.trim().length > 0 ? reflection.rose_text.trim() : null,
    bud_text: reflection.bud_text && reflection.bud_text.trim().length > 0 ? reflection.bud_text.trim() : null,
    thorn_text: reflection.thorn_text && reflection.thorn_text.trim().length > 0 ? reflection.thorn_text.trim() : null,
    rose_transcript: reflection.rose_transcript && reflection.rose_transcript.trim().length > 0 ? reflection.rose_transcript.trim() : null,
    bud_transcript: reflection.bud_transcript && reflection.bud_transcript.trim().length > 0 ? reflection.bud_transcript.trim() : null,
    thorn_transcript: reflection.thorn_transcript && reflection.thorn_transcript.trim().length > 0 ? reflection.thorn_transcript.trim() : null,
    submitted_at: reflection.submitted_at ?? null,
  } : null

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:py-8 md:p-24 pt-safe pb-safe">
      <div className="text-center w-full max-w-2xl">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">
          Welcome{profile?.first_name ? `, ${profile.first_name}` : ''}!
        </h1>
        
        {/* State 1: No reflection yet */}
        {dashboardState === 'no_reflection' && (
          <div className="space-y-4 sm:space-y-6">
            <p className="text-base sm:text-lg md:text-xl text-gray-600">
              Your reflection isn't done yet.
            </p>
            <a
              href="/reflection"
              className="inline-block bg-rose text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-lg hover:bg-rose-dark active:bg-rose-dark font-medium text-base sm:text-lg transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
            >
              Start Reflection
            </a>
          </div>
        )}

        {/* State 2: Reflection submitted but circle not unlocked */}
        {dashboardState === 'waiting' && reflectionData && (
          <div className="space-y-4 sm:space-y-6">
            <p className="text-base sm:text-lg md:text-xl text-gray-600">
              Your reflection is complete.
            </p>
            <p className="text-sm sm:text-base text-gray-500">
              We'll text you when everyone is done.
            </p>
            <div className="pt-2 sm:pt-4">
              <ExportReflection 
                reflection={reflectionData}
                weekStartDate={new Date(currentWeek.start_at)}
                weekEndDate={new Date(currentWeek.end_at)}
              />
            </div>
          </div>
        )}

        {/* State 3: Circle unlocked */}
        {dashboardState === 'unlocked' && (
          <div className="space-y-4 sm:space-y-6">
            <ReadingStatus weekId={currentWeek.id} isUnlocked={isUnlocked} />
            {reflectionData && (
              <div className="pt-2 sm:pt-4">
                <ExportReflection 
                  reflection={reflectionData}
                  weekStartDate={new Date(currentWeek.start_at)}
                  weekEndDate={new Date(currentWeek.end_at)}
                />
              </div>
            )}
          </div>
        )}

        {/* Debug info (can remove later) */}
        <div className="mt-6 sm:mt-8 space-y-2">
          <div className="bg-gray-100 p-3 sm:p-4 rounded-lg text-left">
            <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
              <strong>Circle:</strong> {circleName}
            </p>
            <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
              <strong>Week:</strong> {new Date(currentWeek.start_at).toLocaleDateString()} - {new Date(currentWeek.end_at).toLocaleDateString()}
            </p>
            <p className="text-xs sm:text-sm text-gray-600">
              <strong>State:</strong> {dashboardState} | <strong>Unlocked:</strong> {isUnlocked ? 'Yes' : 'No'}
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

