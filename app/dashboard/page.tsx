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
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center max-w-md">
          <div className="bg-yellow-100 p-4 rounded-md mb-4">
            <p className="text-sm text-yellow-700">
              Unable to load current week. Please refresh the page.
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (!membership) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center max-w-md">
          <p className="text-lg text-gray-600">
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center max-w-md w-full">
        <h1 className="text-4xl font-bold mb-4">
          Welcome{profile?.first_name ? `, ${profile.first_name}` : ''}!
        </h1>
        
        {/* State 1: No reflection yet */}
        {dashboardState === 'no_reflection' && (
          <div className="space-y-4">
            <p className="text-lg text-gray-600">
              Your reflection isn't done yet.
            </p>
            <a
              href="/reflection"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium"
            >
              Start Reflection
            </a>
          </div>
        )}

        {/* State 2: Reflection submitted but circle not unlocked */}
        {dashboardState === 'waiting' && reflection && (
          <div className="space-y-4">
            <p className="text-lg text-gray-600">
              Your reflection is complete.
            </p>
            <p className="text-sm text-gray-500">
              We'll text you when everyone is done.
            </p>
            <div className="pt-2">
              <ExportReflection 
                reflection={reflection}
                weekStartDate={new Date(currentWeek.start_at)}
                weekEndDate={new Date(currentWeek.end_at)}
              />
            </div>
          </div>
        )}

        {/* State 3: Circle unlocked */}
        {dashboardState === 'unlocked' && (
          <div className="space-y-4">
            <ReadingStatus weekId={currentWeek.id} isUnlocked={isUnlocked} />
            {reflection && (
              <div className="pt-2">
                <ExportReflection 
                  reflection={reflection}
                  weekStartDate={new Date(currentWeek.start_at)}
                  weekEndDate={new Date(currentWeek.end_at)}
                />
              </div>
            )}
          </div>
        )}

        {/* Debug info (can remove later) */}
        <div className="mt-8 space-y-2">
          <div className="bg-gray-100 p-3 rounded-md text-left">
            <p className="text-xs text-gray-600 mb-1">
              <strong>Circle:</strong> {circleName}
            </p>
            <p className="text-xs text-gray-600 mb-1">
              <strong>Week:</strong> {new Date(currentWeek.start_at).toLocaleDateString()} - {new Date(currentWeek.end_at).toLocaleDateString()}
            </p>
            <p className="text-xs text-gray-600">
              <strong>State:</strong> {dashboardState} | <strong>Unlocked:</strong> {isUnlocked ? 'Yes' : 'No'}
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

