import { NextRequest, NextResponse } from 'next/server'
import { sendSMS } from '@/lib/twilio/sms'

/**
 * Test route to send a test SMS
 * This is a temporary admin route for Chunk 9 testing
 * TODO: Remove or secure this route before production
 */
export async function POST(request: NextRequest) {
  try {
    // Check environment variables first (for debugging)
    const hasAccountSid = !!process.env.TWILIO_ACCOUNT_SID
    const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN
    const hasPhoneNumber = !!process.env.TWILIO_PHONE_NUMBER

    if (!hasAccountSid || !hasAuthToken || !hasPhoneNumber) {
      const missing = []
      if (!hasAccountSid) missing.push('TWILIO_ACCOUNT_SID')
      if (!hasAuthToken) missing.push('TWILIO_AUTH_TOKEN')
      if (!hasPhoneNumber) missing.push('TWILIO_PHONE_NUMBER')
      
      return NextResponse.json(
        {
          error: 'Missing Twilio credentials',
          details: `Missing environment variables: ${missing.join(', ')}. Please check your .env.local file and restart the dev server.`,
        },
        { status: 500 }
      )
    }

    const { phoneNumber } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Validate phone number format (basic check)
    if (!phoneNumber.startsWith('+')) {
      return NextResponse.json(
        { error: 'Phone number must be in E.164 format (e.g., +1234567890)' },
        { status: 400 }
      )
    }

    const testMessage = 'Test message from Rose-Bud-Thorn app. If you received this, SMS integration is working! 🌹'

    const messageSid = await sendSMS(phoneNumber, testMessage)

    return NextResponse.json({
      success: true,
      messageSid,
      message: 'Test SMS sent successfully',
    })
  } catch (error: any) {
    console.error('Test SMS error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      status: error.status,
    })
    
    return NextResponse.json(
      {
        error: 'Failed to send test SMS',
        details: error.message || 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

