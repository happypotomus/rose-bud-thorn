'use client'

import { Suspense } from 'react'
import InviteForm from './invite-form'

export default function InvitePage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
    }>
      <InviteForm />
    </Suspense>
  )
}
