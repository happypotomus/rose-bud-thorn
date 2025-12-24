import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreateCircleForm } from './create-circle-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function CreateCirclePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/invite')
  }

  // Get user's profile to find circles they own
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/invite')
  }

  // Get all circles owned by this user
  const { data: ownedCircles } = await supabase
    .from('circles')
    .select('id, name, invite_link, created_at')
    .eq('circle_owner', profile.first_name)
    .order('created_at', { ascending: false })

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:py-8 md:p-24 pt-safe pb-safe">
      <div className="w-full max-w-4xl space-y-8">
        {/* Back button */}
        <Link
          href="/home"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Home</span>
        </Link>

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-black mb-2">
            Create New Circle
          </h1>
          <p className="text-gray-600 text-base sm:text-lg">
            Start a new reflection circle and invite others to join
          </p>
        </div>

        {/* Create Circle Form */}
        <div className="flex justify-center">
          <CreateCircleForm />
        </div>

        {/* Previously Created Circles Table */}
        {ownedCircles && ownedCircles.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Your Created Circles
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Circle Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Invite Link
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {ownedCircles.map((circle) => (
                      <tr key={circle.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {circle.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(circle.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {circle.invite_link ? (
                            <a
                              href={circle.invite_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-rose hover:text-rose-dark underline break-all"
                            >
                              {circle.invite_link}
                            </a>
                          ) : (
                            <span className="text-gray-400">No link available</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {(!ownedCircles || ownedCircles.length === 0) && (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">
              You haven't created any circles yet. Create your first circle above!
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
