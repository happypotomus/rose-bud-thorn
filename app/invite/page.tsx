import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingFlow } from './onboarding-flow'
import InviteForm from './invite-form'
import type { Metadata } from 'next'

type InvitePageProps = {
  searchParams: Promise<{ token?: string }>
}

// Generate metadata for Open Graph and Twitter Cards
export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://rosebuds.app')
  
  const imageUrl = `${baseUrl}/og-invite-image.png`

  return {
    title: 'Rose, Bud & Thorn - Create Your Circle',
    description: 'A weekly ritual tool for small private circles. Every Sunday at 7pm, reflect on your week with friends.',
    openGraph: {
      title: 'Rose, Bud & Thorn',
      description: 'A weekly ritual tool for small private circles. Every Sunday at 7pm, reflect on your week with friends.',
      images: [
        {
          url: imageUrl,
          width: 1424,
          height: 752,
          alt: 'Rose, Bud & Thorn - Create Your Circle',
        },
      ],
      url: `${baseUrl}/invite`,
      type: 'website',
      siteName: 'Rose, Bud & Thorn',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Rose, Bud & Thorn',
      description: 'A weekly ritual tool for small private circles',
      images: [imageUrl],
    },
    metadataBase: new URL(baseUrl),
  }
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
