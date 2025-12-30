import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { isCircleUnlocked } from '@/lib/supabase/unlock'

/**
 * API route to find which circle(s) are unlocked for a given week
 * Used when /read page doesn't have a circleId parameter
 */
export async function POST(request: NextRequest) {
  try {
    const { weekId } = await request.json()

    if (!weekId) {
      return NextResponse.json(
        { error: 'Missing weekId' },
        { status: 400 }
      )
    }

    const serverSupabase = await createServerClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await serverSupabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all user's circles
    const { data: memberships } = await serverSupabase
      .from('circle_members')
      .select('circle_id')
      .eq('user_id', user.id)

    if (!memberships || memberships.length === 0) {
      return NextResponse.json(
        { error: 'You are not in any circles' },
        { status: 404 }
      )
    }

    const circleIds = memberships.map(m => m.circle_id)

    // Use service role client for unlock checks
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check which circles are unlocked
    const unlockedCircles: string[] = []
    
    for (const circleId of circleIds) {
      const unlocked = await isCircleUnlocked(circleId, weekId, serviceSupabase)
      if (unlocked) {
        unlockedCircles.push(circleId)
      }
    }

    if (unlockedCircles.length === 0) {
      return NextResponse.json({
        unlocked: false,
        circleId: null,
        weekId,
        message: 'No circles are unlocked for this week',
      })
    }

    // If multiple circles are unlocked, find the most recently unlocked one
    // by checking notification_logs for the most recent unlock notification
    let selectedCircleId = unlockedCircles[0] // Default to first unlocked
    
    if (unlockedCircles.length > 1) {
      const { data: recentUnlock } = await serviceSupabase
        .from('notification_logs')
        .select('circle_id')
        .eq('user_id', user.id)
        .eq('week_id', weekId)
        .eq('type', 'unlock')
        .in('circle_id', unlockedCircles)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single()

      if (recentUnlock) {
        selectedCircleId = recentUnlock.circle_id
      }
    }

    return NextResponse.json({
      unlocked: true,
      circleId: selectedCircleId,
      weekId,
      allUnlockedCircles: unlockedCircles,
    })
  } catch (error) {
    console.error('Error finding unlocked circle:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
