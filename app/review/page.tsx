import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPastUnlockedWeeks, formatWeekRange } from '@/lib/supabase/review'
import { DownloadReflections } from './download-reflections'
import { CircleSwitcher } from '../home/circle-switcher'
import Link from 'next/link'

type ReviewPageProps = {
  searchParams: Promise<{ circleId?: string }>
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = await searchParams
  const selectedCircleId = params.circleId
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const redirectUrl = selectedCircleId 
      ? `/review?circleId=${selectedCircleId}`
      : '/review'
    redirect(`/login?redirectTo=${encodeURIComponent(redirectUrl)}`)
  }

  // Get all user's circle memberships
  const { data: memberships } = await supabase
    .from('circle_members')
    .select(`
      circle_id,
      circles (
        id,
        name
      )
    `)
    .eq('user_id', user.id)

  if (!memberships || memberships.length === 0) {
    redirect('/home')
  }

  // Determine which circle to use
  const circles = memberships.map(m => ({
    id: m.circle_id,
    name: Array.isArray(m.circles) 
      ? m.circles[0]?.name ?? 'Your Circle'
      : ((m.circles as { name?: string } | null)?.name ?? 'Your Circle')
  }))

  const selectedCircle = selectedCircleId && circles.find(c => c.id === selectedCircleId)
    ? circles.find(c => c.id === selectedCircleId)!
    : circles[0]

  const circleId = selectedCircle.id

  // Get past unlocked weeks grouped by month (filtered to only weeks where user has a submission)
  const monthGroups = await getPastUnlockedWeeks(circleId, supabase, user.id)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:py-8 md:p-24 pt-safe pb-safe">
      <div className="w-full max-w-2xl">
        <div className="mb-6 sm:mb-8">
          <Link
            href={`/home${selectedCircleId ? `?circleId=${selectedCircleId}` : ''}`}
            className="text-gray-600 hover:text-gray-800 text-sm sm:text-base inline-flex items-center gap-2"
          >
            ← Back to Home
          </Link>
        </div>

        {/* Circle Switcher */}
        {circles.length > 1 && (
          <CircleSwitcher circles={circles} currentCircleId={circleId} />
        )}

        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
            Review Reflections
          </h1>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <Link
              href="/review/my-reflections?page=1"
              className="px-6 py-2 border-2 border-rose text-rose bg-transparent rounded-lg hover:bg-rose hover:text-white font-medium text-sm sm:text-base transition-colors"
            >
              Review all your reflections
            </Link>
            {monthGroups.length > 0 && (
              <DownloadReflections userId={user.id} circleId={circleId} />
            )}
          </div>
        </div>

        {monthGroups.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <p className="text-gray-600 text-base sm:text-lg">
              No past reflections to review yet.
            </p>
            <p className="text-gray-500 text-sm sm:text-base mt-2">
              Completed weeks will appear here once your circle has unlocked.
            </p>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {monthGroups.map((group) => (
              <div key={group.month}>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">
                  {group.month}
                </h2>
                <div className="space-y-2 sm:space-y-3">
                  {group.weeks.map((week) => (
                    <Link
                      key={week.id}
                      href={`/review/${week.id}${selectedCircleId ? `?circleId=${selectedCircleId}` : ''}`}
                      className="block bg-white border border-gray-200 rounded-lg p-4 sm:p-5 hover:border-gray-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base sm:text-lg font-medium text-gray-900">
                          {formatWeekRange(week.start_at, week.end_at)}
                        </span>
                        <span className="text-gray-400">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
