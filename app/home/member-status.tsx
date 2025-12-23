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
    <div className="w-full max-w-md mx-auto">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">
        Circle Status
      </h2>
      <div className="space-y-2 sm:space-y-2.5">
        {members.map((member) => (
          <div
            key={member.userId}
            className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-colors ${
              member.hasCompleted
                ? 'bg-green-50 border border-green-200'
                : 'bg-gray-50 border border-gray-200'
            }`}
          >
            <div
              className={`flex-shrink-0 ${
                member.hasCompleted ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              {member.hasCompleted ? (
                <Check className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </div>
            <span
              className={`text-base sm:text-lg font-medium flex-1 ${
                member.hasCompleted ? 'text-green-800' : 'text-gray-600'
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
