'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type FriendReflection = {
  user_id: string
  first_name: string
  rose_text: string
  bud_text: string
  thorn_text: string
}

export default function ReadPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [friends, setFriends] = useState<FriendReflection[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [weekId, setWeekId] = useState<string | null>(null)
  const [circleId, setCircleId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadReflections = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/dashboard')
          return
        }

        // Get current week
        const { data: weekData, error: weekError } = await supabase
          .rpc('get_or_create_current_week')
          .single()

        if (weekError || !weekData) {
          setError('Unable to load current week')
          setLoading(false)
          return
        }

        const week = weekData as { id: string; start_at: string; end_at: string; created_at: string }
        setWeekId(week.id)

        // Get user's circle
        const { data: membership } = await supabase
          .from('circle_members')
          .select('circle_id')
          .eq('user_id', user.id)
          .single()

        if (!membership) {
          setError('You are not in a circle')
          setLoading(false)
          return
        }

        setCircleId(membership.circle_id)

        // Get all circle members (excluding current user)
        const { data: allMembers } = await supabase
          .from('circle_members')
          .select('user_id')
          .eq('circle_id', membership.circle_id)
          .neq('user_id', user.id)

        if (!allMembers || allMembers.length === 0) {
          // No other members, go straight to bloom
          setFriends([])
          setLoading(false)
          return
        }

        // Get reflections for all members for current week
        const { data: reflections } = await supabase
          .from('reflections')
          .select(`
            user_id,
            rose_text,
            bud_text,
            thorn_text,
            profiles (
              first_name
            )
          `)
          .eq('circle_id', membership.circle_id)
          .eq('week_id', week.id)
          .not('submitted_at', 'is', null)
          .in('user_id', allMembers.map(m => m.user_id))

        if (!reflections) {
          setError('Unable to load reflections')
          setLoading(false)
          return
        }

        // Transform and sort alphabetically by first name
        const friendReflections: FriendReflection[] = reflections
          .map((r: any) => ({
            user_id: r.user_id,
            first_name: (r.profiles as { first_name: string } | null)?.first_name || 'Friend',
            rose_text: r.rose_text || '',
            bud_text: r.bud_text || '',
            thorn_text: r.thorn_text || '',
          }))
          .sort((a, b) => a.first_name.localeCompare(b.first_name))

        setFriends(friendReflections)
      } catch (err) {
        console.error('Error loading reflections:', err)
        setError('Something went wrong. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadReflections()
  }, [supabase, router])

  const handleNext = () => {
    if (currentIndex < friends.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const markAsRead = () => {
    if (weekId) {
      const readKey = `reflection_read_${weekId}`
      localStorage.setItem(readKey, 'true')
    }
  }

  const handleContinue = () => {
    if (currentIndex < friends.length - 1) {
      handleNext()
    } else {
      // Last friend - mark as read
      markAsRead()
      // The bloom screen will show automatically due to the condition check
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <p className="text-lg text-gray-600">Loading reflections...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center max-w-md">
          <p className="text-lg text-red-600 mb-4">{error}</p>
          <Link
            href="/dashboard"
            className="text-blue-600 hover:underline"
          >
            Return to dashboard
          </Link>
        </div>
      </main>
    )
  }

  // If no friends or all friends viewed, show bloom screen
  if (friends.length === 0 || currentIndex >= friends.length) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center max-w-md space-y-6">
          <div className="text-6xl mb-4">🌸</div>
          <h1 className="text-3xl font-bold">
            Your circle is in full bloom this week.
          </h1>
          <p className="text-lg text-gray-600">
            You're all caught up.
          </p>
          <Link
            href="/dashboard"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium"
          >
            Return to Dashboard
          </Link>
        </div>
      </main>
    )
  }

  const currentFriend = friends[currentIndex]
  const isLastFriend = currentIndex === friends.length - 1

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-6 text-center">
          <p className="text-sm text-gray-600">
            {currentIndex + 1} of {friends.length}
          </p>
        </div>

        {/* Friend's reflection */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6">
            {currentFriend.first_name}'s Reflection
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-2 text-rose-600">🌹 Rose</h3>
              <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded">
                {currentFriend.rose_text || '(No response)'}
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2 text-green-600">🌱 Bud</h3>
              <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded">
                {currentFriend.bud_text || '(No response)'}
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2 text-orange-600">🌵 Thorn</h3>
              <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded">
                {currentFriend.thorn_text || '(No response)'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-center">
          {isLastFriend ? (
            <button
              onClick={handleContinue}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Finish Reading
            </button>
          ) : (
            <button
              onClick={handleContinue}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              See {friends[currentIndex + 1]?.first_name}'s entry
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

