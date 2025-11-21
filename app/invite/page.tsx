'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function InvitePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  
  const [firstName, setFirstName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')

  const supabase = createClient()

  // Invalid token handling
  if (!token) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Invalid Invite Link</h1>
          <p className="text-gray-600">
            This invite link doesn't seem to be active. It might be old or typed incorrectly. 
            Please ask the person who invited you to resend it.
          </p>
        </div>
      </main>
    )
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Verify token exists in circles table
      const { data: circle, error: circleError } = await supabase
        .from('circles')
        .select('id, name')
        .eq('invite_token', token)
        .single()

      // Enhanced error logging
      if (circleError) {
        console.error('Circle lookup error details:', {
          message: circleError.message,
          details: circleError.details,
          hint: circleError.hint,
          code: circleError.code,
        })
        console.error('Full error object:', circleError)
        console.error('Error keys:', Object.keys(circleError))
        console.error('Token used:', token)
        console.error('Circle data returned:', circle)
      }

      // Check if it's a "no rows" error (common with .single())
      if (circleError) {
        // PGRST116 = no rows found, PGRST117 = multiple rows found
        if (circleError.code === 'PGRST116' || circleError.message?.includes('JSON object requested')) {
          setError('This invite link is not valid. Please ask for a new one.')
        } else {
          setError(circleError.message || 'Failed to verify invite link. Please try again.')
        }
        setLoading(false)
        return
      }

      if (!circle) {
        setError('This invite link is not valid. Please ask for a new one.')
        setLoading(false)
        return
      }

      // Send OTP via Supabase
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: phone,
        options: {
          data: {
            first_name: firstName,
            invite_token: token,
          },
        },
      })

      if (otpError) {
        setError(otpError.message || 'Failed to send OTP. Please try again.')
        setLoading(false)
        return
      }

      setOtpSent(true)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Verify OTP
      const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
        phone: phone,
        token: otp,
        type: 'sms',
      })

      if (verifyError || !authData.user) {
        setError(verifyError?.message || 'Invalid OTP. Please try again.')
        setLoading(false)
        return
      }

      // Handle profile creation and circle membership on server
      const response = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authData.user.id,
          firstName,
          phone,
          inviteToken: token,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to complete setup. Please try again.')
        setLoading(false)
        return
      }

      // If user was already in a circle, they'll be redirected
      // Otherwise, redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (otpSent) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Verify Your Phone</h1>
            <p className="text-gray-600">
              We sent a code to {phone}. Please enter it below.
            </p>
          </div>

          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium mb-2">
                Verification Code
              </label>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Join Your Circle</h1>
          <p className="text-gray-600">
            Enter your information to get started
          </p>
        </div>

        <form onSubmit={handleSendOTP} className="space-y-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium mb-2">
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Your first name"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-2">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Include country code (e.g., +1 for US)
            </p>
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending Code...' : 'Send Verification Code'}
          </button>
        </form>
      </div>
    </main>
  )
}

