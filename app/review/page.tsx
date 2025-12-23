import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPastUnlockedWeeks, formatWeekRange } from '@/lib/supabase/review'
import Link from 'next/link'

export default async function ReviewPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/invite')
  }

  // Get user's circle
  const { data: membership } = await supabase
    .from('circle_members')
    .select('circle_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    redirect('/home')
  }

  // Get past unlocked weeks grouped by month
  const monthGroups = await getPastUnlockedWeeks(membership.circle_id, supabase)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:py-8 md:p-24 pt-safe pb-safe">
      <div className="w-full max-w-2xl">
        <div className="mb-6 sm:mb-8">
          <Link
            href="/home"
            className="text-gray-600 hover:text-gray-800 text-sm sm:text-base inline-flex items-center gap-2"
          >
            ← Back to Home
          </Link>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 sm:mb-8 text-center">
          Review Reflections
        </h1>

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
                      href={`/review/${week.id}`}
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
