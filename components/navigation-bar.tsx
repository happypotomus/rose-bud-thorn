'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import { HomeIcon } from './home-icon'

type NavigationBarProps = {
  children: React.ReactNode
}

function HomeIconWrapper() {
  return <HomeIcon />
}

export function NavigationBar({ children }: NavigationBarProps) {
  const pathname = usePathname()
  
  // Pages where home icon should NOT appear
  const hideHomeIconPages = ['/home', '/login', '/invite', '/invite-landing']
  
  const shouldShowHomeIcon = !hideHomeIconPages.includes(pathname)

  return (
    <>
      {shouldShowHomeIcon && (
        <Suspense fallback={null}>
          <HomeIconWrapper />
        </Suspense>
      )}
      {children}
    </>
  )
}

