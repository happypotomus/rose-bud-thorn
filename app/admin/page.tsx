import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminQueryInterface } from './admin-query-interface'

const ADMIN_USER_ID = 'f1c36939-dee5-4305-8dca-af25d538ab65'

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/admin')
  }

  // Verify user is admin
  if (user.id !== ADMIN_USER_ID) {
    redirect('/home')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start px-4 py-6 sm:py-8 md:p-24 pt-safe pb-safe">
      <div className="w-full max-w-6xl">
        <AdminQueryInterface />
      </div>
    </main>
  )
}

