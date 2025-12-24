'use client'

import { useState, useRef, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type HamburgerMenuProps = {
  currentCircleId?: string
}

export function HamburgerMenu({ currentCircleId }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
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

  const reviewLink = currentCircleId 
    ? `/review?circleId=${currentCircleId}`
    : '/review'

  return (
    <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
        aria-label="Menu"
      >
        {isOpen ? (
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        ) : (
          <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
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
        </div>
      )}
    </div>
  )
}
