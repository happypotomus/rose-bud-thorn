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
    const unlocked = await isCircleUnlocked(circleId, weekId, serviceSupabase)

    return NextResponse.json({
      unlocked,
      circleId,
      weekId,
    })
  } catch (error) {
    console.error('Error checking unlock status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
