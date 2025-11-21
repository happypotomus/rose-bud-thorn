import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek } from '@/lib/supabase/week'

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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold mb-4">
          Welcome{profile?.first_name ? `, ${profile.first_name}` : ''}!
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          You're successfully logged in.
        </p>
        {membership && (
          <div className="bg-gray-100 p-4 rounded-md mb-4">
            <p className="text-sm text-gray-700">
              Circle: {(membership.circles as { name: string } | null)?.name || 'Your Circle'}
            </p>
          </div>
        )}
        {currentWeek && (
          <div className="bg-gray-100 p-4 rounded-md mb-4">
            <p className="text-sm text-gray-700">
              Current Week: {new Date(currentWeek.start_at).toLocaleDateString()} - {new Date(currentWeek.end_at).toLocaleDateString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Week ID: {currentWeek.id.substring(0, 8)}...
            </p>
          </div>
        )}
        {!currentWeek && (
          <div className="bg-yellow-100 p-4 rounded-md mb-4">
            <p className="text-sm text-yellow-700">
              Unable to load current week
            </p>
          </div>
        )}
        <p className="text-sm text-gray-500 mt-8">
          This is a placeholder dashboard. Reflection features coming soon!
        </p>
      </div>
    </main>
  )
}

