// API route to send unlock SMS after reflection submission
// Called from the reflection submission flow to check if circle is unlocked and send SMS

import { NextRequest, NextResponse } from 'next/server'
import { sendUnlockSMS } from '@/lib/supabase/unlock-sms'

export async function POST(request: NextRequest) {
  try {
    const { circleId, weekId } = await request.json()

    if (!circleId || !weekId) {
      return NextResponse.json(
        { error: 'Missing circleId or weekId' },
        { status: 400 }
      )
    }

    const result = await sendUnlockSMS(circleId, weekId)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send unlock SMS', details: result.details },
        { status: 500 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in send-unlock-sms route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


