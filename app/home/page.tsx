import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek } from '@/lib/supabase/week-server'
import { isCircleUnlocked } from '@/lib/supabase/unlock'
import { didUserJoinMidWeek, getNextWeekStart } from '@/lib/supabase/midweek-join'
import { ReadingStatus } from './reading-status'
import { ExportReflection } from './export-reflection'
import { MemberStatus } from './member-status'
import { FlowerLogo } from '@/components/flower-logo'
import Link from 'next/link'
import { CircleSwitcher } from './circle-switcher'
import { HamburgerMenu } from './hamburger-menu'

type HomePageProps = {
  searchParams: Promise<{ circleId?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  const selectedCircleId = params.circleId
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/invite')
  }

  // Get user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('id', user.id)
    .single()

  // Get all user's circle memberships
  // Order by created_at DESC so most recently joined circle is first (default)
  const { data: memberships, error: membershipsError } = await supabase
    .from('circle_members')
    .select(`
      circle_id,
      created_at,
      circles (
        id,
        name
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Home] Memberships:', memberships)
    console.log('[Home] Memberships error:', membershipsError)
    console.log('[Home] Memberships count:', memberships?.length)
  }

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

  if (!memberships || memberships.length === 0) {
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

  // Determine which circle to use
  // If circleId is provided in URL, use it (if user is a member)
  // Otherwise, use the first circle
  const circles = memberships.map(m => {
    const circleName = Array.isArray(m.circles) 
      ? m.circles[0]?.name ?? 'Your Circle'
      : ((m.circles as { name?: string } | null)?.name ?? 'Your Circle')
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Home] Processing membership:', { circle_id: m.circle_id, circles: m.circles, circleName })
    }
    
    return {
      id: m.circle_id,
      name: circleName
    }
  })

  if (process.env.NODE_ENV === 'development') {
    console.log('[Home] Final circles array:', circles)
    console.log('[Home] Circles count:', circles.length)
  }

  const selectedCircle = selectedCircleId && circles.find(c => c.id === selectedCircleId)
    ? circles.find(c => c.id === selectedCircleId)!
    : circles[0]

  const circleId = selectedCircle.id
  const circleName = selectedCircle.name

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
      thorn_transcript,
      rose_audio_url,
      bud_audio_url,
      thorn_audio_url,
      photo_url,
      photo_caption
    `)
    .eq('user_id', user.id)
    .eq('circle_id', circleId)
    .eq('week_id', currentWeek.id)
    .single()

  // Check if user joined mid-week (after the current week started) for the selected circle
  const joinedMidWeek = await didUserJoinMidWeek(user.id, currentWeek.id, circleId)
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[Home page] Mid-week check result:', {
      userId: user.id,
      weekId: currentWeek.id,
      weekStart: new Date(currentWeek.start_at).toISOString(),
      joinedMidWeek
    })
  }

  // Check if circle is unlocked using real unlock logic
  const isUnlocked = await isCircleUnlocked(circleId, currentWeek.id, supabase)

  // Get all circle members for status display
  const { data: allMembers } = await supabase
    .from('circle_members')
    .select('user_id, created_at')
    .eq('circle_id', circleId)

  // Get all profiles for circle members
  const memberUserIds = allMembers?.map(m => m.user_id) || []
  const { data: memberProfiles } = await supabase
    .from('profiles')
    .select('id, first_name')
    .in('id', memberUserIds)

  // Get all submitted reflections for current week
  const { data: submittedReflections } = await supabase
    .from('reflections')
    .select('user_id')
    .eq('circle_id', circleId)
    .eq('week_id', currentWeek.id)
    .not('submitted_at', 'is', null)

  // Create set of user IDs who have submitted
  const submittedUserIds = new Set(
    submittedReflections?.map(r => r.user_id) || []
  )

  // Build member status list (exclude mid-week joiners from status display)
  const weekStart = new Date(currentWeek.start_at)
  const memberStatus = (allMembers || [])
    .filter(m => new Date(m.created_at) <= weekStart) // Only show pre-week members
    .map(member => {
      const profile = memberProfiles?.find(p => p.id === member.user_id)
      return {
        userId: member.user_id,
        firstName: profile?.first_name || 'Unknown',
        hasCompleted: submittedUserIds.has(member.user_id),
      }
    })
    .sort((a, b) => a.firstName.localeCompare(b.firstName)) // Sort alphabetically

  // Check if user has read all reflections (client-side check via localStorage)
  // We'll check this on the client side since localStorage is client-only
  const hasReadReflections = false // Will be checked client-side

  // Determine home state
  let homeState: 'no_reflection' | 'waiting' | 'unlocked' | 'read' | 'midweek_joiner' = 'no_reflection'
  
  if (joinedMidWeek) {
    // User joined mid-week - show special message
    homeState = 'midweek_joiner'
  } else if (!reflection) {
    homeState = 'no_reflection'
  } else if (reflection && !isUnlocked) {
    homeState = 'waiting'
  } else if (isUnlocked) {
    // Check reading status will be done client-side
    homeState = 'unlocked'
  }

  // Calculate next week start for mid-week joiners
  const nextWeekStart = joinedMidWeek ? getNextWeekStart(new Date(currentWeek.end_at)) : null

  // Explicitly map reflection data to ensure proper serialization when passing to client component
  // Convert empty strings to null for consistent handling (empty strings come from audio-only submissions)
  const reflectionData = reflection ? {
    rose_text: reflection.rose_text && reflection.rose_text.trim().length > 0 ? reflection.rose_text.trim() : null,
    bud_text: reflection.bud_text && reflection.bud_text.trim().length > 0 ? reflection.bud_text.trim() : null,
    thorn_text: reflection.thorn_text && reflection.thorn_text.trim().length > 0 ? reflection.thorn_text.trim() : null,
    rose_transcript: reflection.rose_transcript && reflection.rose_transcript.trim().length > 0 ? reflection.rose_transcript.trim() : null,
    bud_transcript: reflection.bud_transcript && reflection.bud_transcript.trim().length > 0 ? reflection.bud_transcript.trim() : null,
    thorn_transcript: reflection.thorn_transcript && reflection.thorn_transcript.trim().length > 0 ? reflection.thorn_transcript.trim() : null,
    rose_audio_url: reflection.rose_audio_url && reflection.rose_audio_url.trim().length > 0 ? reflection.rose_audio_url.trim() : null,
    bud_audio_url: reflection.bud_audio_url && reflection.bud_audio_url.trim().length > 0 ? reflection.bud_audio_url.trim() : null,
    thorn_audio_url: reflection.thorn_audio_url && reflection.thorn_audio_url.trim().length > 0 ? reflection.thorn_audio_url.trim() : null,
    photo_url: reflection.photo_url && reflection.photo_url.trim().length > 0 ? reflection.photo_url.trim() : null,
    photo_caption: reflection.photo_caption && reflection.photo_caption.trim().length > 0 ? reflection.photo_caption.trim() : null,
    submitted_at: reflection.submitted_at ?? null,
  } : null

  // Format next week start date for display
  const formatNextWeekStart = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
    return date.toLocaleDateString('en-US', options)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:py-8 md:p-24 pt-safe pb-safe relative">
      {/* Hamburger Menu */}
      <HamburgerMenu currentCircleId={circleId} circleName={circleName} />
      
      {/* Circle Switcher - positioned absolutely at top center */}
      {circles.length > 1 && (
        <CircleSwitcher circles={circles} currentCircleId={circleId} />
      )}
      
      <div className="text-center w-full max-w-2xl">
        {/* State: Mid-week joiner */}
        {homeState === 'midweek_joiner' && nextWeekStart ? (
          <div className="space-y-5 sm:space-y-6">
            <div className="flex justify-center mb-2 sm:mb-4">
              <FlowerLogo size={72} className="sm:w-20 sm:h-20" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-black">
              Welcome{profile?.first_name ? `, ${profile.first_name}` : ''}!
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-600">
              The new round for the circle starts {formatNextWeekStart(nextWeekStart)}.
            </p>
            <p className="text-sm sm:text-base text-gray-500">
              We'll notify you when the time is ready!
            </p>
          </div>
        ) : homeState === 'no_reflection' ? (
          /* State 1: No reflection yet - First time user design */
          <div className="space-y-5 sm:space-y-6">
            <div className="flex justify-center mb-2 sm:mb-4">
              <FlowerLogo size={72} className="sm:w-20 sm:h-20" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-black">
              Get started with your first reflection
            </h1>
            <p className="text-base sm:text-lg text-gray-600">
              Take a moment to reflect on your week.
            </p>
            <div className="pt-2 sm:pt-4">
              <Link
                href="/reflection"
                className="inline-block bg-rose text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-lg hover:bg-rose-dark active:bg-rose-dark font-medium text-base sm:text-lg transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
              >
                Start Reflection
              </Link>
            </div>
            {memberStatus.length > 0 && (
              <div className="pt-2 sm:pt-4">
                <MemberStatus members={memberStatus} />
              </div>
            )}
          </div>
        ) : (
          <>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">
              Welcome{profile?.first_name ? `, ${profile.first_name}` : ''}!
            </h1>
            
            {/* State 2: Reflection submitted but circle not unlocked */}
            {homeState === 'waiting' && reflectionData && (
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
                {memberStatus.length > 0 && (
                  <div className="pt-2 sm:pt-4">
                    <MemberStatus members={memberStatus} />
                  </div>
                )}
              </div>
            )}

            {/* State 3: Circle unlocked */}
            {homeState === 'unlocked' && (
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
          </>
        )}

      </div>
    </main>
  )
}





