'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type ReadingStatusProps = {
  weekId: string
  isUnlocked: boolean
}

export function ReadingStatus({ weekId, isUnlocked }: ReadingStatusProps) {
  const [hasRead, setHasRead] = useState(false)

  useEffect(() => {
    if (weekId && isUnlocked) {
      const readKey = `reflection_read_${weekId}`
      const readStatus = localStorage.getItem(readKey)
      setHasRead(readStatus === 'true')
    }
  }, [weekId, isUnlocked])

  if (!isUnlocked) {
    return null
  }

  if (hasRead) {
    return (
      <div className="space-y-4">
        <p className="text-lg text-gray-600">
          You've read all reflections for this week.
        </p>
        <Link
          href="/read"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium"
        >
          Revisit this week's reflections
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-lg text-gray-600">
        Your circle is unlocked!
      </p>
      <Link
        href="/read"
        className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium"
      >
        Read Reflections
      </Link>
    </div>
  )
}

