import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
          <div className="bg-gray-100 p-4 rounded-md">
            <p className="text-sm text-gray-700">
              Circle: {(membership.circles as { name: string } | null)?.name || 'Your Circle'}
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

