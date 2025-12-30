import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { circleId } = await request.json()

    if (!circleId) {
      return NextResponse.json(
        { error: 'Circle ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a member of this circle
    const { data: membership, error: membershipError } = await supabase
      .from('circle_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('circle_id', circleId)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'You are not a member of this circle' },
        { status: 404 }
      )
    }

    // Delete the membership
    const { error: deleteError } = await supabase
      .from('circle_members')
      .delete()
      .eq('id', membership.id)

    if (deleteError) {
      console.error('Failed to delete circle membership:', deleteError)
      return NextResponse.json(
        { error: 'Failed to leave circle' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully left circle',
    })
  } catch (error) {
    console.error('Leave circle error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
