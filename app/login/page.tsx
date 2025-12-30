import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from './login-form'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://rosebuds.app')

  return {
    title: 'Sign In - Rose, Bud & Thorn',
    description: 'Sign in to your Rose, Bud & Thorn account',
    metadataBase: new URL(baseUrl),
  }
}

async function LoginPageContent({ 
  searchParams 
}: { 
  searchParams: Promise<{ redirectTo?: string }> 
}) {
  const params = await searchParams
  const redirectTo = params.redirectTo || '/home'
  const supabase = await createClient()

  // Check if user is already authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is logged in, redirect to their destination
  if (user) {
    redirect(redirectTo)
  }

  return <LoginForm redirectTo={redirectTo} />
}

export default function LoginPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ redirectTo?: string }> 
}) {
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
      <LoginPageContent searchParams={searchParams} />
    </Suspense>
  )
}
