'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export function HomeIcon() {
  const searchParams = useSearchParams()
  const circleId = searchParams.get('circleId')
  
  const homeUrl = circleId ? `/home?circleId=${circleId}` : '/home'

  return (
    <Link
      href={homeUrl}
      className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50 p-2 text-gray-600 hover:text-gray-800 transition-colors"
      aria-label="Return to home"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6 sm:w-7 sm:h-7"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    </Link>
  )
}

