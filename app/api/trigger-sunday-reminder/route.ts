// API route to manually trigger Sunday reminder Edge Function
// For testing purposes in dev

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase environment variables' },
        { status: 500 }
      )
    }

    // In production, this would call the deployed Edge Function
    // For local dev, you can either:
    // 1. Run `supabase functions serve` and call localhost
    // 2. Deploy the function and call the deployed URL
    // 3. For now, we'll provide instructions

    // Construct function URL from Supabase URL
    const functionUrl = `${supabaseUrl}/functions/v1/sunday-reminder`

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Function execution failed', details: data },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error triggering Sunday reminder:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

