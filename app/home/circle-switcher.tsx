'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

type Circle = {
  id: string
  name: string
}

type CircleSwitcherProps = {
  circles: Circle[]
  currentCircleId: string
}

export function CircleSwitcher({ circles, currentCircleId }: CircleSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selectedCircleId, setSelectedCircleId] = useState(currentCircleId)

  useEffect(() => {
    setSelectedCircleId(currentCircleId)
  }, [currentCircleId])

  const handleCircleChange = (circleId: string) => {
    setSelectedCircleId(circleId)
    // Update URL with new circleId
    const params = new URLSearchParams(searchParams.toString())
    params.set('circleId', circleId)
    // Use current pathname to support both /home and /review
    router.push(`${pathname}?${params.toString()}`)
    // Refresh the page to load new circle data
    router.refresh()
  }

  // Don't show switcher if user only has one circle
  if (circles.length <= 1) {
    return null
  }

  const selectedCircle = circles.find(c => c.id === selectedCircleId) || circles[0]

  return (
    <div className="w-full flex justify-center pt-16 px-6">
      <div className="relative inline-block">
        <select
          value={selectedCircleId}
          onChange={(e) => handleCircleChange(e.target.value)}
          className="w-auto min-w-[140px] h-9 px-3 pr-8 text-sm font-medium text-black bg-muted/50 rounded-md border-0 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-0 transition-all hover:bg-muted/70"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M2 4L6 8L10 4' stroke='%23000000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.5rem center',
            paddingRight: '2rem',
          }}
        >
          {circles.map((circle) => (
            <option key={circle.id} value={circle.id}>
              {circle.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}



