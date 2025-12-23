import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FlowerLogo } from '@/components/flower-logo'
import type { Metadata } from 'next'

// Generate metadata for Open Graph and Twitter Cards
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}): Promise<Metadata> {
  const params = await searchParams
  const token = params.token

  // Get base URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://rose-bud-thorn.vercel.app')
  
  const imageUrl = `${baseUrl}/og-invite-image.png`

  if (!token) {
    return {
      title: 'Rose, Bud & Thorn - Invalid Invite Link',
      description: 'This invite link doesn\'t seem to be active.',
      openGraph: {
        title: 'Rose, Bud & Thorn',
        description: 'A weekly ritual tool for small private circles',
        images: [imageUrl],
        url: `${baseUrl}/invite-landing`,
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Rose, Bud & Thorn',
        description: 'A weekly ritual tool for small private circles',
        images: [imageUrl],
      },
    }
  }

  // Fetch circle data for dynamic metadata
  const supabase = await createClient()
  const { data: circle } = await supabase
    .from('circles')
    .select('circle_owner')
    .eq('invite_token', token)
    .single()

  const ownerName = circle?.circle_owner || 'Someone'
  const title = `Rose, Bud & Thorn - ${ownerName} invited you to join their Circle`
  const description = `${ownerName} invited you to join their Circle. Every Sunday at 7pm, reflect on your week with friends.`
  const url = `${baseUrl}/invite-landing?token=${token}`

  return {
    title,
    description,
    openGraph: {
      title: 'Rose, Bud & Thorn',
      description: `${ownerName} invited you to join their Circle`,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: 'Rose, Bud & Thorn - Join a Circle',
        },
      ],
      url,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Rose, Bud & Thorn',
      description: `${ownerName} invited you to join their Circle`,
      images: [imageUrl],
    },
  }
}

async function InviteLandingContent({ token }: { token: string }) {
  const supabase = await createClient()

  // Fetch circle by invite_token
  const { data: circle, error } = await supabase
    .from('circles')
    .select('id, name, circle_owner, invite_token')
    .eq('invite_token', token)
    .single()

  if (error || !circle) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:py-8 bg-white pt-safe pb-safe">
        <div className="text-center w-full max-w-2xl px-4">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4">Invalid Invite Link</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            This invite link doesn't seem to be active. It might be old or typed incorrectly.
            Please ask the person who invited you to resend it.
          </p>
        </div>
      </main>
    )
  }

  const ownerName = circle.circle_owner || 'Someone'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:py-8 bg-white pt-safe pb-safe">
      <div className="w-full max-w-lg sm:max-w-xl md:max-w-2xl space-y-5 sm:space-y-6 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-2 sm:mb-4">
          <FlowerLogo size={72} className="sm:w-20 sm:h-20" />
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-black px-2">Rose, Bud & Thorn</h1>

        {/* Invitation text */}
        <p className="text-gray-600 text-sm sm:text-base md:text-lg px-2">
          {ownerName} invited you to join their Circle
        </p>

        {/* Content box */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 md:p-8 text-left space-y-4 sm:space-y-5">
          <p className="text-gray-800 text-sm sm:text-base md:text-lg leading-relaxed">
            Every Sunday at 7pm, reflect on your week with friends
          </p>

          <div className="space-y-4 sm:space-y-5 pt-2">
            {/* Rose */}
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0 mt-0.5 sm:mt-1">
                <FlowerLogo size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-black text-sm sm:text-base">Rose</p>
                <p className="text-gray-600 text-xs sm:text-sm md:text-base leading-relaxed">Something that went well</p>
              </div>
            </div>

            {/* Bud */}
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0 mt-0.5 sm:mt-1">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="sm:w-6 sm:h-6"
                >
                  <path
                    d="M12 2C12 2 8 6 8 10C8 13 10 15 12 15C14 15 16 13 16 10C16 6 12 2 12 2Z"
                    fill="#6FCF97"
                  />
                  <path
                    d="M12 15L12 22"
                    stroke="#6FCF97"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-black text-sm sm:text-base">Bud</p>
                <p className="text-gray-600 text-xs sm:text-sm md:text-base leading-relaxed">Something emerging or hopeful</p>
              </div>
            </div>

            {/* Thorn */}
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0 mt-0.5 sm:mt-1">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="sm:w-6 sm:h-6"
                >
                  <path
                    d="M12 2L14 8L20 10L14 12L12 18L10 12L4 10L10 8L12 2Z"
                    fill="#9B51E0"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-black text-sm sm:text-base">Thorn</p>
                <p className="text-gray-600 text-xs sm:text-sm md:text-base leading-relaxed">A challenge you faced</p>
              </div>
            </div>
          </div>
        </div>

        {/* Join button */}
        <Link
          href={`/invite?token=${token}`}
          className="inline-block w-full bg-rose text-white py-3.5 sm:py-3 px-6 rounded-lg hover:bg-rose-dark active:bg-rose-dark font-medium text-base sm:text-lg transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
        >
          Join {ownerName}'s Circle
        </Link>

        {/* Footer disclaimer */}
        <p className="text-gray-500 text-xs sm:text-sm leading-relaxed px-2 pb-2">
          You'll receive a weekly text reminder. Reflections only unlock once everyone has shared theirs.
        </p>
      </div>
    </main>
  )
}

export default function InviteLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
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
      <InviteLandingWrapper searchParams={searchParams} />
    </Suspense>
  )
}

async function InviteLandingWrapper({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token = params.token

  if (!token) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:py-8 bg-white pt-safe pb-safe">
        <div className="text-center w-full max-w-2xl px-4">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4">Invalid Invite Link</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            This invite link doesn't seem to be active. It might be old or typed incorrectly.
            Please ask the person who invited you to resend it.
          </p>
        </div>
      </main>
    )
  }

  return <InviteLandingContent token={token} />
}





