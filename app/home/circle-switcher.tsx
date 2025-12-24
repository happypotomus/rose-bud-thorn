'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

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

  return (
    <div className="mb-6 sm:mb-8">
      <label htmlFor="circle-select" className="block text-sm font-medium text-gray-700 mb-2">
        Select Circle
      </label>
      <select
        id="circle-select"
        value={selectedCircleId}
        onChange={(e) => handleCircleChange(e.target.value)}
        className="w-full sm:w-auto min-w-[200px] px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg bg-white text-base sm:text-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {circles.map((circle) => (
          <option key={circle.id} value={circle.id}>
            {circle.name}
          </option>
        ))}
      </select>
    </div>
  )
}



