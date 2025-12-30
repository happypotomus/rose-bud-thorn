'use client'

import { useState, useRef, useEffect } from 'react'
import { Settings, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type HamburgerMenuProps = {
  currentCircleId?: string
  circleName?: string
}

export function HamburgerMenu({ currentCircleId, circleName }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMenuItemClick = () => {
    setIsOpen(false)
  }

  const handleLeaveCircle = () => {
    setShowConfirmDialog(true)
    setIsOpen(false)
  }

  const handleConfirmLeave = async () => {
    if (!currentCircleId) {
      setError('No circle selected')
      return
    }

    setIsLeaving(true)
    setError(null)

    try {
      const response = await fetch('/api/leave-circle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circleId: currentCircleId }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to leave circle. Please try again.')
        setIsLeaving(false)
        return
      }

      // Fetch remaining circles to determine redirect
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: remainingCircles } = await supabase
          .from('circle_members')
          .select('circle_id')
          .eq('user_id', user.id)

        if (remainingCircles && remainingCircles.length > 0) {
          // Redirect to home with first remaining circle
          router.push(`/home?circleId=${remainingCircles[0].circle_id}`)
        } else {
          // No circles left, redirect to invite page
          router.push('/invite')
        }
      } else {
        // Not authenticated, redirect to invite
        router.push('/invite')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setIsLeaving(false)
    }
  }

  const handleCancelLeave = () => {
    setShowConfirmDialog(false)
    setError(null)
  }

  const reviewLink = currentCircleId 
    ? `/review?circleId=${currentCircleId}`
    : '/review'

  return (
    <>
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
          aria-label="Settings"
        >
          {isOpen ? (
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </button>

        {isOpen && (
          <div className="absolute top-12 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[200px] z-30">
            <Link
              href={reviewLink}
              onClick={handleMenuItemClick}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Review past reflections
            </Link>
            <Link
              href="/create-circle"
              onClick={handleMenuItemClick}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Create new circle
            </Link>
            <a
              href="mailto:itspmenon@gmail.com"
              onClick={handleMenuItemClick}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Help
            </a>
            {currentCircleId && (
              <button
                onClick={handleLeaveCircle}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 transition-colors"
              >
                Leave Circle
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Leave Circle</h2>
            <p className="text-gray-600">
              Are you sure you want to leave {circleName ? `"${circleName}"` : 'this circle'}? 
              You'll no longer be able to see reflections from this circle.
            </p>
            
            {error && (
              <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelLeave}
                disabled={isLeaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLeave}
                disabled={isLeaving}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLeaving ? 'Leaving...' : 'Leave Circle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
