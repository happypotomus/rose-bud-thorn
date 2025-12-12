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
      <div className="space-y-4 sm:space-y-6">
        <p className="text-base sm:text-lg md:text-xl text-gray-600">
          You've read all reflections for this week.
        </p>
        <Link
          href="/read"
          className="inline-block w-full sm:w-auto bg-rose text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-lg hover:bg-rose-dark active:bg-rose-dark font-medium text-base sm:text-lg transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
        >
          Revisit this week's reflections
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <p className="text-base sm:text-lg md:text-xl text-gray-600">
        Your circle is unlocked!
      </p>
      <Link
        href="/read"
        className="inline-block w-full sm:w-auto bg-rose text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-lg hover:bg-rose-dark active:bg-rose-dark font-medium text-base sm:text-lg transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
      >
        Read Reflections
      </Link>
    </div>
  )
}

