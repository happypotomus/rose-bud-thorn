import { Suspense } from 'react'
import { ReadContent } from './read-content'

export default function ReadPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:p-12 md:p-24 pb-safe">
        <div className="text-center">
          <p className="text-base sm:text-lg text-gray-600">Loading reflections...</p>
        </div>
      </main>
    }>
      <ReadContent />
    </Suspense>
  )
}
