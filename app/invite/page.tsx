import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingFlow } from './onboarding-flow'
import InviteForm from './invite-form'

type InvitePageProps = {
  searchParams: Promise<{ token?: string }>
}

async function InvitePageContent({ searchParams }: InvitePageProps) {
  const params = await searchParams
  const token = params.token
  const supabase = await createClient()

  // Check if user is already authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is logged in, redirect to home
  if (user) {
    redirect('/home')
  }

  // If token is provided, show existing invite form (for joining existing circles)
  if (token) {
    return <InviteForm />
  }

  // No token = new user onboarding flow
  return <OnboardingFlow />
}

export default function InvitePage({ searchParams }: InvitePageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 bg-white pt-safe pb-safe">
          <div className="text-center">
            <p className="text-gray-600 text-sm sm:text-base">Loading...</p>
          </div>
        </main>
      }
    >
      <InvitePageContent searchParams={searchParams} />
    </Suspense>
  )
}
