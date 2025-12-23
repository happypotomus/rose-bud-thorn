'use client'

import { Check, X } from 'lucide-react'

type MemberStatus = {
  userId: string
  firstName: string
  hasCompleted: boolean
}

type MemberStatusProps = {
  members: MemberStatus[]
}

export function MemberStatus({ members }: MemberStatusProps) {
  if (members.length === 0) {
    return null
  }

  return (
    <div className="w-full max-w-md mx-auto text-center">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">
        Circle Status
      </h2>
      <div className="space-y-2 sm:space-y-2.5 flex flex-col items-center">
        {members.map((member) => (
          <div
            key={member.userId}
            className="flex items-center gap-2 sm:gap-3"
          >
            <div
              className={`flex-shrink-0 ${
                member.hasCompleted ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              {member.hasCompleted ? (
                <Check className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </div>
            <span
              className={`text-base sm:text-lg font-medium ${
                member.hasCompleted ? 'text-green-600' : 'text-gray-600'
              }`}
            >
              {member.firstName}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
