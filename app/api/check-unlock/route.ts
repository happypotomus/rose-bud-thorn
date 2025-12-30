import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { isCircleUnlocked } from '@/lib/supabase/unlock'

/**
 * API route to check if a circle is unlocked
 * Uses service role client to bypass RLS issues (same as unlock SMS)
 */
export async function POST(request: NextRequest) {
  try {
    const { circleId, weekId } = await request.json()

    if (!circleId || !weekId) {
      return NextResponse.json(
        { error: 'Missing circleId or weekId' },
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

    // Verify user is a member of the circle
    const { data: membership, error: membershipError } = await serverSupabase
      .from('circle_members')
      .select('id')
      .eq('circle_id', circleId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'You are not a member of this circle' },
        { status: 403 }
      )
    }

    // Use service role client for unlock check (same as unlock SMS)
    // This bypasses RLS and ensures consistent results
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Add detailed logging for debugging
    console.log(`[UNLOCK CHECK] Starting check for circleId: ${circleId}, weekId: ${weekId}`)
    
    // Get week details
    const { data: week } = await serviceSupabase
      .from('weeks')
      .select('start_at')
      .eq('id', weekId)
      .single()
    
    if (!week) {
      console.error(`[UNLOCK CHECK] Week ${weekId} not found`)
      return NextResponse.json(
        { error: 'Week not found' },
        { status: 404 }
      )
    }
    
    const weekStart = new Date(week.start_at)
    console.log(`[UNLOCK CHECK] Week start: ${weekStart.toISOString()}`)
    
    // Get all members
    const { data: members } = await serviceSupabase
      .from('circle_members')
      .select('user_id, created_at')
      .eq('circle_id', circleId)
    
    console.log(`[UNLOCK CHECK] Total members: ${members?.length || 0}`)
    
    const preWeekMemberIds = members
      ?.filter(m => new Date(m.created_at) <= weekStart)
      .map(m => m.user_id) || []
    
    console.log(`[UNLOCK CHECK] Pre-week members: ${preWeekMemberIds.length}`, preWeekMemberIds)
    
    // Get submitted reflections
    const { data: reflections } = await serviceSupabase
      .from('reflections')
      .select('user_id')
      .eq('circle_id', circleId)
      .eq('week_id', weekId)
      .not('submitted_at', 'is', null)
    
    const submittedUserIds = new Set(reflections?.map(r => r.user_id) || [])
    console.log(`[UNLOCK CHECK] Submitted reflections: ${reflections?.length || 0}`, Array.from(submittedUserIds))
    
    // Check which pre-week members are missing
    const missing = preWeekMemberIds.filter(id => !submittedUserIds.has(id))
    if (missing.length > 0) {
      console.log(`[UNLOCK CHECK] Missing submissions from:`, missing)
    }
    
    const unlocked = await isCircleUnlocked(circleId, weekId, serviceSupabase)
    console.log(`[UNLOCK CHECK] Final result: ${unlocked ? 'UNLOCKED' : 'LOCKED'}`)

    return NextResponse.json({
      unlocked,
      circleId,
      weekId,
      debug: {
        weekStart: weekStart.toISOString(),
        totalMembers: members?.length || 0,
        preWeekMembers: preWeekMemberIds.length,
        submittedReflections: reflections?.length || 0,
        missingSubmissions: missing,
      },
    })
  } catch (error) {
    console.error('Error checking unlock status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
